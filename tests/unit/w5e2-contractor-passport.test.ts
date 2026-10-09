/** F33 Contractor and supplier skills passport (W5 · E2, M09): every acceptance criterion on the local path, the card's RBAC, the pure rules
 *  (passport evidence, pre-check, team matrix), the seed, the routes and i18n. The SQL path is checked by
 *  scripts/validate/w5e2-contractor-passport.mjs (PGlite: SQL = TS parity for every contractor x standard, RLS, the same flows). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { SCHEMA } from '../../src/data/schema';
import { lintRanked } from '../../src/domain/engines';
import { verifyCredential } from '../../src/modules/m17/issuer';
import {
  CPMSG, GAP_PROGRAMMES, TASK_LINKS, contractorEvidence, contractorOrgOf, courseSkills, linkState, precheck, securityCompsOf, standardSkills, taskLinkRows,
} from '../../src/modules/m09/contractor';
import { teamMatrix } from '../../src/modules/m09/teamMatrix';
import { routes } from '../../src/modules/m09/routes';
import { makeSupabaseM09 } from '../../src/modules/m09/backend/supabase';
import seed from '../../src/seed/seed.json';
import arJson from '../../src/i18n/m09.ar.json';
import enJson from '../../src/i18n/m09.en.json';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables; // eslint-disable-line @typescript-eslint/no-explicit-any
const DEMO = (seed as unknown as { meta: { demo_today: string } }).meta.demo_today;
const today = new Date().toISOString().slice(0, 10);
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const audits = (action: string, outcome?: string) => b.raw('audit_events').filter((a) => a.action === action && (!outcome || a.outcome === outcome));
const orgKind = (o: string) => T.organisations.find((x) => x.id === o)?.kind;
const contractors = T.people.filter((p) => contractorOrgOf(p, orgKind));
const world = () => ({
  skills: b.raw('skills') as never, comps: b.raw('competencies'), courses: b.raw('courses'), standards: b.raw('qual_standards'), roleComps: b.raw('role_competencies'),
  certificates: b.raw('certificates'), equivalency: b.raw('equivalency_requests'), engagements: b.raw('contractor_engagements' as never),
});
const pc = (person: string, std: string) => precheck({
  person_id: person, standard: b.rawGet('qual_standards', std)!, tasks: b.raw('task_items'), links: b.raw('task_skill_links' as never), states: b.raw('person_skills').filter((s) => s.person_id === person),
  skills: b.raw('skills') as never, comps: b.raw('competencies'), requests: b.raw('equivalency_requests'), courses: b.raw('courses'),
});

describe('F33 seed', () => {
  it('seeds contractors at three synthetic suppliers with academy certificates, ENEC engagements, equivalency decisions and contracted profiles', () => {
    const by = (o: string) => contractors.filter((p) => p.org_id === o && p.kind === 'contractor').length;
    expect(by('org-alnoor')).toBe(12);
    expect(by('org-gulfhydro')).toBe(9);
    expect(by('org-dhafra')).toBe(11); // ten synthetic staff and the k-contractor persona
    expect(T.people.filter((p) => p.kind === 'contractor' && p.id.startsWith('c-')).every((p) => p.synthetic === true && !p.persona_id)).toBe(true);
    expect(T.contractor_engagements.length).toBeGreaterThan(50);
    expect(T.contractor_engagements.every((g) => / \(synthetic\)$/.test(g.title_en) && g.source === 'mirror')).toBe(true);
    expect(new Set(T.contract_role_targets.map((x) => x.org_id))).toEqual(new Set(['org-alnoor', 'org-gulfhydro', 'org-dhafra']));
    expect(T.certificates.some((c) => c.status === 'expired')).toBe(true);
    expect(new Set(T.equivalency_requests.map((r) => r.status))).toEqual(new Set(['submitted', 'under_review', 'equivalent', 'training_required']));
  });
  it('stored passport evidence equals contractorEvidence() for every contractor; existing onboarding self-ratings are kept', () => {
    const w = { skills: T.skills, comps: T.competencies, courses: T.courses, standards: T.qual_standards, roleComps: T.role_competencies, certificates: T.certificates, equivalency: T.equivalency_requests, engagements: T.contractor_engagements };
    let n = 0;
    for (const p of contractors) {
      const want = contractorEvidence(p.id, w as never, DEMO);
      n += want.length;
      for (const e of want) {
        const s = T.skill_evidence.find((x) => x.id === e.id);
        expect(s, e.id).toBeTruthy();
        expect([s.level, s.basis, s.active, s.status, s.ref_table]).toEqual([e.level, e.basis, e.active, e.status, e.ref_table]);
      }
    }
    expect(n).toBeGreaterThan(300);
    for (const id of ['c-alnoor-01', 'p-alnoor-gm', 'p-k-contractor']) expect(T.skill_evidence.find((e) => e.id === `se:rating:${id}:sk-qa-01`)?.basis).toBe('claimed');
  });
  it('every person_skills and skill_evidence row carries the org stamp of its person (contractor rows only)', () => {
    const org = new Map(T.people.map((p) => [p.id, contractorOrgOf(p, orgKind)]));
    for (const t of ['person_skills', 'skill_evidence']) for (const r of T[t]) expect([r.org_id, r.contractor]).toEqual([org.get(r.person_id) ?? null, org.get(r.person_id) != null]);
    expect(T.person_skills.filter((r) => r.contractor).length).toBeGreaterThan(200);
  });
  it('the task → skill map covers every task of every non-security standard and never a security skill or standard', () => {
    const sec = new Set(T.qual_standards.filter((s) => s.security_restricted).map((s) => s.id));
    const tasks = T.task_items.filter((x) => !sec.has(x.standard_id));
    expect(tasks.every((x) => TASK_LINKS[x.id]?.length)).toBe(true);
    const secSkills = securityCompsOf(T.competencies);
    expect(T.task_skill_links.every((l) => !sec.has(l.standard_id) && !secSkills.has(T.skills.find((s) => s.id === l.skill_id).competency_id))).toBe(true);
    expect(taskLinkRows(T.task_items)).toEqual(T.task_skill_links);
  });
});

describe('F33 rules', () => {
  it('courseSkills mirrors the F04 alignment; standardSkills follows the F01 qualification mapping and gives nothing for security', () => {
    const sec = securityCompsOf(T.competencies);
    expect(courseSkills(T.courses.find((c) => c.id === 'c-sa-cgd-103'), T.skills, sec)).toEqual([{ skill_id: 'sk-qa-02', level: 2 }, { skill_id: 'sk-qa-02-cgd', level: 2 }]);
    const mech = standardSkills(T.qual_standards.find((s) => s.id === 'qs-mech'), T.skills, T.role_competencies, sec);
    expect(mech).toContainEqual({ skill_id: 'sk-mp-01-mech', level: 3 });
    expect(mech).toContainEqual({ skill_id: 'sk-mp-01', level: 3 });
    expect(standardSkills(T.qual_standards.find((s) => s.id === 'qs-sec'), T.skills, T.role_competencies, sec)).toEqual([]);
  });
  it('link states: strong with records, claimed when only self-claimed, near one level short, none otherwise', () => {
    expect([linkState(3, 'evidenced', 3), linkState(3, 'claimed', 2), linkState(2, 'validated', 3), linkState(1, 'evidenced', 3), linkState(0, 'none', 1)]).toEqual(['strong', 'claimed', 'near', 'none', 'none']);
  });
  it('pre-check outcomes on the seed: already equivalent, likely, review with a prior mapping, training likely; suggestions pass lintRanked', () => {
    expect(pc('c-alnoor-01', 'qs-mech').outlook).toBe('already_equivalent');
    const a2 = pc('c-alnoor-02', 'qs-mech');
    expect(a2.outlook).toBe('likely_equivalent');
    expect(a2.open_request_id).toBe('eq-2');
    const g1 = pc('c-gulf-01', 'qs-elec');
    expect(g1.prior_request_id).toBe('eq-4');
    expect(g1.tasks.filter((t) => t.prior).map((t) => t.task_id)).toEqual(['qs-elec-t1', 'qs-elec-t3']);
    const outlooks = new Set(contractors.flatMap((p) => ['qs-mech', 'qs-elec', 'qs-qa', 'qs-rp', 'qs-get', 'qs-ro'].map((s) => pc(p.id, s).outlook)));
    expect(outlooks).toEqual(new Set(['already_equivalent', 'likely_equivalent', 'review', 'training_likely']));
    for (const p of contractors.slice(0, 12)) {
      const r = pc(p.id, 'qs-qa');
      expect(lintRanked(r.suggestions)).toEqual([]);
      expect(r.tasks.every((t) => t.reasons.length > 0 && t.reasons.every((x) => x.key.startsWith('m09.reasons.')))).toBe(true);
      expect(r.suggestions.every((s) => GAP_PROGRAMMES.includes(String(b.rawGet('courses', s.id)!.programme_id)))).toBe(true);
      expect(r.coverage).toBe(Math.round(((r.likely + r.partial / 2) / r.total) * 100));
    }
  });
  it('the team matrix ranks assigned contractors by readiness, with reasons, coverage and the role\'s standards', () => {
    const people = T.people.filter((p) => p.org_id === 'org-alnoor' && p.kind === 'contractor');
    const m = teamMatrix({ people, states: T.person_skills, skills: T.skills, comps: T.competencies, roleComps: T.role_competencies, roleId: 'maintenance-technician-engineer', band: '10-24', requests: T.equivalency_requests, standards: T.qual_standards });
    expect(m.rows).toHaveLength(12);
    expect(m.bandMin).toBe(10);
    expect(m.required.map((r) => r.competency_id).sort()).toEqual(['hu-01', 'mp-01', 'mp-02', 'qa-01', 'rp-01']);
    expect(m.standards.map((s) => s.id)).toEqual(['qs-elec', 'qs-ic', 'qs-mech']);
    expect(m.rows[0].assigned).toBe(true);
    const assigned = m.rows.filter((r) => r.assigned);
    expect(assigned.every((r, i) => i === 0 || assigned[i - 1].readiness >= r.readiness)).toBe(true);
    expect(m.rows.find((r) => r.person.id === 'c-alnoor-01')!.eq.find((e) => e.standard_id === 'qs-mech')!.status).toBe('equivalent');
    expect(lintRanked(m.rows.map((r) => ({ id: r.person.id, score: r.readiness, reasons: r.reasons })))).toEqual([]);
    expect(m.coverage.every((c) => c.met === m.rows.filter((r) => r.cells.find((x) => x.competency_id === c.competency_id)!.status === 'met').length)).toBe(true);
  });
});

describe('F33 acceptance: no cross-organisation reads (alnoor-gm vs gulfhydro-qa)', () => {
  it('a partner admin reads only their own organisation\'s passports, engagements and contracted profiles', async () => {
    for (const [persona, org, other] of [['alnoor-gm', 'org-alnoor', 'org-gulfhydro'], ['gulfhydro-qa', 'org-gulfhydro', 'org-alnoor']] as const) {
      await as(persona);
      for (const t of ['person_skills', 'skill_evidence', 'contractor_engagements', 'contract_role_targets'] as const) {
        const rows = (await b.list(t as never)) as { org_id: string | null; person_id?: string }[];
        expect(rows.length, `${persona} ${t}`).toBeGreaterThan(0);
        expect(rows.every((r) => r.org_id === org), `${persona} ${t}`).toBe(true);
        expect(rows.some((r) => r.org_id === other)).toBe(false);
      }
    }
  });
  it('the pre-check refuses another organisation\'s contractor as not found and writes an audit row', async () => {
    await as('alnoor-gm');
    const before = audits('equivalency.precheck', 'refused').length;
    const r = await b.rpc.equivalencyPrecheck('c-gulf-03', 'qs-mech');
    expect([r.ok, r.code, r.message]).toEqual([false, 'not_found', CPMSG.not_found_person]);
    await as('gulfhydro-qa');
    expect((await b.rpc.equivalencyPrecheck('c-alnoor-01', 'qs-mech')).code).toBe('not_found');
    expect(audits('equivalency.precheck', 'refused').length).toBe(before + 2);
    expect(await b.rpc.contractorBadges('p-alnoor-qaqc')).toEqual([]);
  });
  it('a contractor reads their own passport only; ENEC evaluators and auditors read contractor rows but no staff rows through it', async () => {
    await as('k-contractor');
    const own = await b.list('person_skills');
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((r) => r.person_id === 'p-k-contractor')).toBe(true);
    expect((await b.rpc.equivalencyPrecheck('c-dhafra-04', 'qs-rp')).code).toBe('not_found');
    await as('k-auditor');
    const aud = await b.list('person_skills');
    expect(aud.filter((r) => r.contractor).length).toBe(b.raw('person_skills').filter((r) => r.contractor).length);
    expect(aud.every((r) => r.contractor || r.person_id === 'p-k-auditor')).toBe(true);
    await as('sro');
    expect((await b.list('person_skills')).some((r) => r.contractor)).toBe(false);
    expect((await b.rpc.equivalencyPrecheck('c-alnoor-01', 'qs-mech')).code).toBe('not_found');
    await as(null);
    expect(await b.list('contractor_engagements' as never)).toEqual([]);
  });
});

describe('F33 acceptance: the pre-check is read-only and excludes security', () => {
  it('never changes the equivalency record; audited with no ledger; same result as the pure rules', async () => {
    await as('alnoor-gm');
    const snap = JSON.stringify(b.raw('equivalency_requests'));
    const ledger = b.raw('ledger_local').length;
    const r = await b.rpc.equivalencyPrecheck('c-alnoor-02', 'qs-mech');
    expect(r.ok).toBe(true);
    expect(JSON.stringify(b.raw('equivalency_requests'))).toBe(snap);
    expect(b.raw('ledger_local').length).toBe(ledger);
    expect(audits('equivalency.precheck', 'ok').at(-1)!.reason).toMatch(/^MNT-MECH: 4\/4 likely/);
    expect(r.data).toEqual(pc('c-alnoor-02', 'qs-mech'));
    await as('training-mgr');
    expect((await b.rpc.equivalencyPrecheck('c-gulf-01', 'qs-elec')).ok).toBe(true);
    await as('k-contractor');
    expect((await b.rpc.equivalencyPrecheck('p-k-contractor', 'qs-get')).ok).toBe(true);
  });
  it('security standards are refused, as in submitEquivalency', async () => {
    await as('alnoor-gm');
    const r = await b.rpc.equivalencyPrecheck('c-alnoor-02', 'qs-sec');
    expect([r.code, r.message]).toEqual(['invalid', CPMSG.security]);
    const s = await b.rpc.submitEquivalency({ person_id: 'c-alnoor-02', person_label: 'x', standard_id: 'qs-sec', evidence: [{ name: 'x', kind: 'certificate' }] });
    expect(s.code).toBe('invalid');
    expect(audits('equivalency.precheck', 'refused').at(-1)!.reason).toContain('invalid');
    expect((await b.rpc.equivalencyPrecheck('c-alnoor-02', 'qs-nope')).code).toBe('not_found');
  });
});

describe('F33 evidence: academy certificates and equivalency decisions feed the passport', () => {
  it('completing a supplier academy course adds certificate evidence and lifts the pre-check (k-contractor, safety culture → GET)', async () => {
    await as('k-contractor');
    expect(pc('p-k-contractor', 'qs-get').tasks[0].status).toBe('partial');
    const en = b.raw('enrolments').find((e) => e.person_id === 'p-k-contractor' && e.course_id === 'c-sa-sc-104')!;
    const checks = new Set(b.raw('academy_checks').filter((c) => c.course_id === 'c-sa-sc-104').map((c) => c.id));
    const answers = b.raw('academy_check_keys').filter((k) => checks.has(k.check_id)).map((k) => ({ check_id: k.check_id, answer: k.answer }));
    const done = await b.rpc.completeSupplierCourse(en.id, answers);
    expect(done.ok).toBe(true);
    const cert = done.data!.certificate_no!;
    const ev = b.rawGet('skill_evidence', `se:credential:${cert}:sk-sc-01`)!;
    expect([ev.basis, ev.level, ev.active, ev.org_id, ev.contractor]).toEqual(['evidenced', 2, true, 'org-dhafra', true]);
    const st = b.rawGet('person_skills', 'ps:p-k-contractor:sk-sc-01')!;
    expect([st.level, st.basis]).toEqual([2, 'evidenced']);
    const r = await b.rpc.equivalencyPrecheck('p-k-contractor', 'qs-get');
    expect(r.data!.outlook).toBe('likely_equivalent');
  });
  it('an "equivalent" decision becomes validated evidence; a revoked certificate stops counting', async () => {
    await as('training-mgr');
    const map = ['qs-mech-t1', 'qs-mech-t2', 'qs-mech-t3', 'qs-mech-t4'].map((t) => ({ task_id: t, covered: true, evidence: [0], note: 'ok' }));
    expect((await b.rpc.mapEquivalency('eq-13', map)).ok).toBe(true);
    expect((await b.rpc.decideEquivalency('eq-13', 'equivalent', 'All tasks evidenced')).ok).toBe(true);
    const ev = b.rawGet('skill_evidence', 'se:credential:eq-13:sk-mp-01-mech')!;
    expect([ev.basis, ev.level, ev.active, ev.org_id]).toEqual(['validated', 3, true, 'org-gulfhydro']);
    expect(b.rawGet('person_skills', 'ps:c-gulf-04:sk-mp-01-mech')!.level).toBe(3);
    b.rawUpdate('certificates', 'SA-CERT-00110', { status: 'revoked' });
    expect(b.raw('skill_evidence').filter((e) => e.ref_id === 'SA-CERT-00110').every((e) => !e.active)).toBe(true);
    expect(contractorEvidence('c-alnoor-01', world(), today).filter((e) => e.ref_id === 'SA-CERT-00110').every((e) => e.status === 'lapsed')).toBe(true);
  });
});

describe('F33 credentials (F04) and contracted role profiles', () => {
  it('a contractor wraps a valid academy certificate as a signed, verifiable badge; refusals for staff, others, duplicates and expired', async () => {
    await as('k-ro');
    expect((await b.rpc.issueContractorBadge('SA-CERT-00101')).code).toBe('forbidden');
    await as('alnoor-qaqc');
    const r = await b.rpc.issueContractorBadge('SA-CERT-00101');
    expect(r.ok).toBe(true);
    expect(b.raw('ledger_local').some((l) => String(l.action) === 'kafaa.badge.issue')).toBe(true);
    const bd = b.rawGet('badges', r.data!.id)!;
    expect(verifyCredential(bd.credential).outcome).toBe('valid');
    expect((await b.rpc.issueContractorBadge('SA-CERT-00101')).code).toBe('already_issued');
    expect((await b.rpc.issueContractorBadge('SA-CERT-00104')).code).toBe('not_found');
    b.rawUpdate('certificates', 'SA-CERT-00102', { valid_to: '2026-01-01' });
    expect((await b.rpc.issueContractorBadge('SA-CERT-00102')).code).toBe('not_eligible');
    expect(b.raw('skill_evidence').some((e) => e.ref_table === 'badges' && e.ref_id === r.data!.id)).toBe(false);
    const self = await b.rpc.contractorBadges('p-alnoor-qaqc');
    expect(self[0].credential).toBeTruthy();
    await as('alnoor-gm');
    expect((await b.rpc.contractorBadges('p-alnoor-qaqc'))[0].credential).toBeTruthy();
    await as('training-mgr');
    expect((await b.rpc.contractorBadges('p-alnoor-qaqc'))[0].credential).toBeNull();
    await as(null);
    expect((await b.rpc.verifyBadge(bd.public_slug)).data?.status).toBe('active');
  });
  it('ENEC (partner_org A) sets contracted profiles with a ledger row; partners, security roles, bad bands and non-suppliers are refused', async () => {
    await as('alnoor-gm');
    expect((await b.rpc.setContractRoleTarget({ org_id: 'org-alnoor', role_id: 'quality-assurance-qc', headcount_band: '25+' })).code).toBe('forbidden');
    await as('ai-governance'); // NEXUS admin role card: the ledger row is written
    const ok = await b.rpc.setContractRoleTarget({ org_id: 'org-gulfhydro', role_id: 'radiation-protection-technician', headcount_band: '1-4', contract_ref: 'X-1', scope_en: 'RP', scope_ar: 'وقاية' });
    expect(ok.ok).toBe(true);
    expect(b.rawGet('contract_role_targets' as never, 'crt-org-gulfhydro-radiation-protection-technician')).toBeTruthy();
    expect(b.raw('ledger_local').some((l) => String(l.action) === 'kafaa.contractor.role_target')).toBe(true);
    expect((await b.rpc.setContractRoleTarget({ org_id: 'org-alnoor', role_id: 'security-officer', headcount_band: '1-4' })).code).toBe('security_restricted');
    expect((await b.rpc.setContractRoleTarget({ org_id: 'org-alnoor', role_id: 'quality-assurance-qc', headcount_band: '3-7' })).code).toBe('invalid');
    expect((await b.rpc.setContractRoleTarget({ org_id: 'ku', role_id: 'quality-assurance-qc', headcount_band: '1-4' })).code).toBe('not_found');
    expect((await b.rpc.setContractRoleTarget({ org_id: 'org-alnoor', role_id: 'quality-assurance-qc', headcount_band: '5-9', active: false })).ok).toBe(true);
    await as('alnoor-gm');
    expect((await b.list('contract_role_targets' as never)).some((x: { id: string }) => x.id === 'crt-org-gulfhydro-radiation-protection-technician')).toBe(false);
  });
});

describe('F33 wiring', () => {
  it('routes, guards, read rules and the Supabase mapping', () => {
    const ids = ['partner-passport', 'partner-passport-person', 'partner-precheck', 'training-equivalency-passport', 'admin-contract-roles'];
    for (const id of ids) expect(routes.find((r) => r.id === id), id).toBeTruthy();
    expect(routes.find((r) => r.id === 'partner-passport')!.guard).toEqual({ signedIn: true, anyRole: ['partner_user', 'partner_admin'] });
    expect(routes.find((r) => r.id === 'training-equivalency-passport')!.guard.anyRole).toEqual(['instructor', 'training_manager', 'auditor']);
    expect(SCHEMA.person_skills.read).toContainEqual({ res: 'equivalency', org: 'org_id', where: 'contractor' });
    expect(SCHEMA.skill_evidence.read).toContainEqual({ res: 'own_profile', person: 'person_id' });
    const calls: string[] = [];
    const x = { call: async (fn: string) => { calls.push(fn); return { ok: true, code: 'ok', message: '' } as never; }, rpc: async (fn: string) => { calls.push(fn); return [] as never; } };
    const m = makeSupabaseM09(x);
    void m.equivalencyPrecheck('a', 'b'); void m.setContractRoleTarget({} as never); void m.issueContractorBadge('c'); void m.contractorBadges('d');
    expect(calls).toEqual(['kafaa_equivalency_precheck', 'kafaa_set_contract_role_target', 'kafaa_issue_contractor_badge', 'kafaa_contractor_badges']);
  });
  it('EN and AR carry every route, reason and passport key; no screen promises a FANR certification', () => {
    const flat = (o: object, p = ''): Record<string, string> => Object.entries(o).reduce((a, [k, v]) => (typeof v === 'object' ? { ...a, ...flat(v, `${p}${k}.`) } : { ...a, [`${p}${k}`]: v }), {} as Record<string, string>);
    const en = flat({ cp: enJson.cp, reasons: enJson.reasons });
    const ar = flat({ cp: arJson.cp, reasons: arJson.reasons });
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
    expect(Object.values(ar).every((v) => v.trim().length > 0)).toBe(true);
    for (const id of ['partner-passport', 'partner-passport-person', 'partner-precheck', 'training-equivalency-passport', 'admin-contract-roles']) {
      expect((enJson.routes as Record<string, { title: string }>)[id].title).toBeTruthy();
      expect((arJson.routes as Record<string, { title: string }>)[id].title).toBeTruthy();
    }
    expect(Object.values(en).filter((v) => /FANR/.test(v)).every((v) => /not a FANR|nothing here is a FANR/i.test(v))).toBe(true);
  });
});
