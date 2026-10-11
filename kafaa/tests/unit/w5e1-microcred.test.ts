/** F32 Stackable micro-credentials (W5 · E1, M17): every acceptance criterion on the local path (reproducible eligibility, stacks only
 *  from valid components, the copy check, expired components flag "renewal due"), the RBAC (own, training manager approval with
 *  maker-checker, framework owners for definitions), versioning, public verification, the seed, routes and i18n. The SQL path is checked
 *  by scripts/validate/w5e1-microcred-ojt.mjs (PGlite, SQL = TS parity and the same flows). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { hasKey } from '../../src/i18n';
import {
  MC_RULES, REGULATORY_WORDING, addMonths, awardView, componentsOf, currentDef, eligibility, evidenceSnapshot, hasRegulatoryWording, reproduce, validateDef,
  type AwardRow, type DefInput, type DefRow, type McWorld,
} from '../../src/modules/m17/microcred';
import { verifyCredential } from '../../src/modules/m17/issuer';
import { makeSupabaseM17 } from '../../src/modules/m17/backend/supabase';
import { routes } from '../../src/modules/m17/routes';
import seed from '../../src/seed/seed.json';
import enJson from '../../src/i18n/m17.en.json';
import arJson from '../../src/i18n/m17.ar.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const DEMO = '2026-10-08';
const today = new Date().toISOString().slice(0, 10);
const defs = T.microcred_defs as DefRow[];
const awards = T.microcred_awards as AwardRow[];
const world = (on = DEMO): McWorld => ({
  today: on, defs, awards, courses: T.courses, training_records: T.training_records, attempts: T.attempts, opportunities: T.opportunities,
  opportunity_applications: T.opportunity_applications, person_skills: T.person_skills,
});
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});
const award = (id: string) => b.rawGet('microcred_awards', id) as unknown as AwardRow;
const awardsNow = () => b.raw('microcred_awards') as unknown as AwardRow[];
const audits = (action: string, outcome?: string) => b.raw('audit_events').filter((a) => a.action === action && (!outcome || a.outcome === outcome));

describe('F32 seed', () => {
  it('seeds published, stacked, draft, retired and versioned definitions; every one passes the copy check', () => {
    expect(new Set(defs.map((d) => d.status))).toEqual(new Set(['current', 'superseded', 'draft', 'retired']));
    const stacks = defs.filter((d) => d.kind === 'stack' && d.status === 'current');
    expect(stacks.length).toBeGreaterThanOrEqual(3);
    for (const s of stacks) expect(componentsOf(defs, s.code).length, s.code).toBeGreaterThanOrEqual(2);
    expect(defs.filter((d) => d.code === 'MC-DATA-ANALYSIS').map((d) => `${d.version}:${d.status}`).sort()).toEqual(['1:superseded', '2:current']);
    for (const d of defs) expect(hasRegulatoryWording(d.title_en, d.title_ar, d.summary_en, d.summary_ar, ...d.criteria.flatMap((c) => [c.label_en, c.label_ar])), d.code).toBe(false);
  });
  it('seeds awards in every state, each signed and verifiable; views include active, renewal due and expired', () => {
    expect(new Set(awards.map((a) => a.status))).toEqual(new Set(['awarded', 'pending_approval', 'declined', 'revoked', 'superseded']));
    const views = new Set(awards.filter((a) => a.status === 'awarded').map((a) => awardView(a, DEMO, awards).status));
    expect(views).toEqual(new Set(['active', 'renewal_due', 'expired']));
    for (const a of awards.filter((x) => x.status === 'awarded' || x.status === 'superseded')) {
      expect(verifyCredential(a.credential as never).outcome, a.id).toBe('valid');
      expect((a.credential as { credentialSubject: { achievement: { achievementType: string } } }).credentialSubject.achievement.achievementType).toBe('MicroCredential');
      expect(a.public_slug).toMatch(/^mc[0-9a-f]{6,}$/);
    }
    expect(awards.every((a) => /^[A-Z]{1,3}$/.test(a.holder_initials))).toBe(true);
  });
});

describe('F32 acceptance: eligibility is reproducible from the listed evidence', () => {
  it('for every staff member and published micro-credential, the met criteria rest on rows that satisfy them on their own', () => {
    const w = world();
    const staff = T.people.filter((p) => p.kind === 'staff').map((p) => p.id);
    let checked = 0;
    for (const def of defs.filter((d) => d.status === 'current' && d.kind === 'micro')) {
      for (const pid of staff) {
        const e = eligibility(def, pid, w);
        expect(eligibility(def, pid, w)).toEqual(e); // deterministic
        if (!e.criteria.some((c) => c.met)) continue;
        expect(reproduce(e, { training_records: T.training_records, attempts: T.attempts, opportunity_applications: T.opportunity_applications, person_skills: T.person_skills }, def, w), `${def.code} ${pid}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });
  it('a forged evidence reference (someone else\'s row) does not reproduce', () => {
    const w = world();
    const def = currentDef(defs, 'MC-DATA-FOUND')!;
    const e = eligibility(def, 'p-qc-inspector', w);
    expect(e.auto_met).toBe(true);
    const other = T.person_skills.find((s) => s.person_id !== 'p-qc-inspector')!;
    const forged = { ...e, criteria: e.criteria.map((c, i) => (i === 0 ? { ...c, evidence: [{ ...c.evidence[0], id: other.id }] } : c)) };
    expect(reproduce(forged, { person_skills: T.person_skills }, def, w)).toBe(false);
  });
  it('an award stores the evidence snapshot; each met criterion points at an existing row of the holder', async () => {
    await as('qc-inspector');
    const r = await b.rpc.awardMicrocred('MC-DATA-FOUND');
    expect(r.ok, r.message).toBe(true);
    const a = award(r.data!.id);
    expect(a.status).toBe('awarded');
    const met = (a.evidence as { status: string; evidence: { table: string; id: string }[] }[]).filter((c) => c.status === 'met');
    expect(met.length).toBeGreaterThan(0);
    for (const c of met) for (const ev of c.evidence) expect((b.rawGet(ev.table as never, ev.id) as { person_id?: string } | undefined)?.person_id).toBe('p-qc-inspector');
    expect(['valid', 'validOffline']).toContain(verifyCredential(a.credential as never).outcome);
    expect(a.key_id).toBe('key-offline');
    // F01: the credential becomes evidence on the passport
    expect(b.raw('skill_evidence').filter((s) => s.ref_table === 'microcred_awards' && s.ref_id === a.id && s.kind === 'credential' && s.basis === 'evidenced').length).toBeGreaterThan(0);
    expect((await b.rpc.awardMicrocred('MC-DATA-FOUND')).code).toBe('already_awarded');
  });
});

describe('F32 acceptance: stacked credentials issue only when every component is valid', () => {
  it('a stack is refused while a part is missing, and issued once every part is held and valid', async () => {
    await as('sro'); // holds HU-PRAC and SCWE, not OE-REVIEW
    const e = await b.rpc.microcredEligibility(null, 'MC-HP-CHAMPION');
    expect(e.allowed && e.items[0].auto_met).toBe(false);
    expect((await b.rpc.awardMicrocred('MC-HP-CHAMPION')).code).toBe('not_eligible');
    expect(audits('microcred.award', 'refused').length).toBeGreaterThan(0);
  });
  it('withdrawing a part flags the stack, blocks its renewal; earning the part again renews the stack over valid parts only', async () => {
    await as('k-ro');
    const stack = awardsNow().find((a) => a.person_id === 'p-k-ro' && a.def_code === 'MC-HP-CHAMPION' && a.status === 'awarded')!;
    const scwe = awardsNow().find((a) => a.person_id === 'p-k-ro' && a.def_code === 'MC-SCWE' && a.status === 'awarded')!;
    expect(awardView(stack, today, awardsNow()).status).toBe('active');
    expect((await b.rpc.revokeMicrocred(scwe.id, 'Withdrawn for the test')).ok).toBe(true);
    expect(awardView(award(stack.id), today, awardsNow())).toMatchObject({ status: 'renewal_due', reason: 'component' });
    expect((await b.rpc.awardMicrocred('MC-HP-CHAMPION')).code).toBe('not_eligible');
    const re = await b.rpc.awardMicrocred('MC-SCWE');
    const rs = await b.rpc.awardMicrocred('MC-HP-CHAMPION');
    expect(re.ok && rs.ok).toBe(true);
    const fresh = award(rs.data!.id);
    expect(fresh.renewed_from).toBe(stack.id);
    expect(award(stack.id).status).toBe('superseded');
    expect(fresh.component_award_ids).toContain(re.data!.id);
    for (const id of fresh.component_award_ids) expect(['active', 'renewal_due']).toContain(awardView(award(id), today, awardsNow()).status);
  });
});

describe('F32 acceptance: expired components flag the stacked credential "renewal due"', () => {
  it('the seeded outage stack is flagged because its planning part expired (DEMO day)', () => {
    const pro = awards.find((a) => a.person_id === 'w-lo-02' && a.def_code === 'MC-OUTAGE-PRO' && a.status === 'awarded')!;
    const plan = awards.find((a) => a.person_id === 'w-lo-02' && a.def_code === 'MC-OUTAGE-PLAN' && a.status === 'awarded')!;
    expect(awardView(plan, DEMO, awards).status).toBe('expired');
    expect(awardView(pro, DEMO, awards)).toMatchObject({ status: 'renewal_due', reason: 'component' });
  });
  it('pure rule: a component past its validity flags the stack; renewing the component (superseded -> renewed) clears it', () => {
    const comp = { id: 'c1', status: 'awarded', valid_to: '2026-01-01', component_award_ids: [] as string[], renewed_from: null };
    const stack = { id: 's1', status: 'awarded', valid_to: '2028-01-01', component_award_ids: ['c1'], renewed_from: null };
    const all = [comp, stack] as unknown as AwardRow[];
    expect(awardView(stack, '2026-06-01', all)).toMatchObject({ status: 'renewal_due', reason: 'component' });
    const renewed = [{ ...comp, status: 'superseded' }, { id: 'c2', status: 'awarded', valid_to: '2028-01-01', component_award_ids: [], renewed_from: 'c1' }, stack] as unknown as AwardRow[];
    expect(awardView(stack, '2026-06-01', renewed).status).toBe('active');
    expect(awardView(stack, '2027-12-01', renewed)).toMatchObject({ status: 'renewal_due', reason: 'window' });
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(awardView(stack, '2028-01-02', renewed).status).toBe('expired');
    expect(MC_RULES.renewWindowDays).toBe(60);
  });
});

describe('F32 acceptance: micro-credentials never imply FANR certification (copy check)', () => {
  const dw = { courses: T.courses, forms: T.assessment_forms ?? T.forms ?? [], opportunities: T.opportunities, skills: T.skills, competencies: T.competencies, defs, job_roles: T.job_roles, qual_standards: T.qual_standards };
  const base: DefInput = {
    code: 'MC-QA-AWARE', kind: 'micro', area: 'quality', level: 'foundation', title_en: 'Quality awareness', title_ar: 'الوعي بالجودة', summary_en: 'Quality basics at work.', summary_ar: 'أساسيات الجودة في العمل.',
    criteria: [{ key: 'hu', kind: 'course', ref: 'c-hu', label_en: 'Human performance tools', label_ar: 'أدوات الأداء البشري' }], stacks_into: null, alignment: [], role_ids: [], validity_months: 24, hours: 6,
  };
  it('refuses licence, certification and FANR wording in English and Arabic, in titles, summaries and criteria', () => {
    expect(validateDef(base, dw as never).code).toBe('ok');
    for (const bad of ['FANR approved quality', 'Certified quality inspector', 'Licensed operator basics', 'Qualified operator track']) expect(validateDef({ ...base, title_en: bad }, dw as never).code, bad).toBe('regulatory_wording');
    expect(validateDef({ ...base, summary_ar: 'شهادة معتمد من الهيئة' }, dw as never).code).toBe('regulatory_wording');
    expect(validateDef({ ...base, criteria: [{ ...base.criteria[0], label_en: 'Holds an RO licence' }] }, dw as never).code).toBe('regulatory_wording');
  });
  it('every issued credential and every catalogue string stays clear of regulator wording; the notice says so', () => {
    for (const a of awards.filter((x) => x.status === 'awarded')) {
      const ach = (a.credential as { credentialSubject: { achievement: { name: string; description: string; criteria: { narrative: string } } } }).credentialSubject.achievement;
      expect(REGULATORY_WORDING.test(`${ach.name} ${ach.description} ${ach.criteria.narrative}`), a.id).toBe(false);
    }
    const flat = (o: unknown, p = ''): [string, string][] => (typeof o === 'string' ? [[p, o]] : Object.entries(o as object).flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k)));
    const disclaimers = new Set(['notice', 'admin.notice', 'admin.wordingTitle', 'admin.wordingBody']);
    for (const lang of [enJson, arJson]) for (const [k, v] of flat((lang as { mc: unknown }).mc)) if (!disclaimers.has(k)) expect(REGULATORY_WORDING.test(v), k).toBe(false);
    expect((enJson as { mc: { notice: string } }).mc.notice).toMatch(/not FANR licences/);
  });
  it('the server refuses a definition with regulator wording (audited) and security or mirror criteria', async () => {
    await as('training-mgr');
    expect((await b.rpc.saveMicrocredDef({ ...base, title_en: 'Quality awareness: FANR licence holder' })).code).toBe('regulatory_wording');
    expect(audits('microcred.def_save', 'refused').length).toBe(1);
    const sec = T.courses.find((c) => c.security_restricted);
    if (sec) expect((await b.rpc.saveMicrocredDef({ ...base, criteria: [{ ...base.criteria[0], ref: sec.id }] })).code).toBe('security_restricted');
  });
});

describe('F32 RBAC, approval and versioning', () => {
  it('own eligibility only; managers in scope; anonymous refused', async () => {
    await as(null);
    expect((await b.rpc.microcredEligibility(null)).allowed).toBe(false);
    await as('k-ro');
    expect(await b.rpc.microcredEligibility('p-qc-inspector')).toMatchObject({ allowed: false, code: 'forbidden' });
    await as('head-sq');
    expect((await b.rpc.microcredEligibility('p-qc-inspector')).allowed).toBe(true);
  });
  it('manual criteria: the request waits for a training manager; maker-checker; approval signs and marks the manual criterion met', async () => {
    const pend = awardsNow().find((a) => a.person_id === 'p-sro' && a.status === 'pending_approval')!;
    await as('sro');
    expect((await b.rpc.decideMicrocredAward(pend.id, 'approve', 'Looks good')).code).toBe('forbidden');
    b.rawInsert('microcred_awards', { ...pend, id: 'mca-test-tm', person_id: 'p-training-mgr', holder_initials: 'TM', public_slug: null } as never);
    await as('training-mgr');
    expect((await b.rpc.decideMicrocredAward('mca-test-tm', 'approve', 'My own request')).code).toBe('maker_checker');
    const ap = await b.rpc.decideMicrocredAward(pend.id, 'approve', 'Project brief and close-out reviewed');
    expect(ap.ok, ap.message).toBe(true);
    const a = award(pend.id);
    expect(a.status).toBe('awarded');
    expect(a.decided_by).toBe('p-training-mgr');
    expect((a.evidence as { kind: string; status: string }[]).find((c) => c.kind === 'manual')?.status).toBe('met');
    expect(b.raw('notifications').some((n) => n.person_id === 'p-sro' && String(n.id).startsWith('nt-mc-'))).toBe(true);
  });
  it('a pure evidence snapshot marks manual criteria met only with an approver', () => {
    const def = currentDef(defs, 'MC-PROJECT')!;
    const e = eligibility(def, 'p-sro', world());
    expect(evidenceSnapshot(e, null, DEMO).find((c) => c.kind === 'manual')?.status).toBe('manual');
    expect(evidenceSnapshot(e, 'p-training-mgr', DEMO).find((c) => c.kind === 'manual')?.status).toBe('met');
  });
  it('definitions: framework owners only; draft -> publish -> revise (v2 supersedes v1) -> retire', async () => {
    const base = { code: 'MC-QA-AWARE', kind: 'micro', area: 'quality', level: 'foundation', title_en: 'Quality awareness', title_ar: 'الوعي بالجودة', summary_en: 'Quality basics.', summary_ar: 'أساسيات الجودة.',
      criteria: [{ key: 'hu', kind: 'course', ref: 'c-hu', label_en: 'Human performance tools', label_ar: 'أدوات الأداء البشري' }], stacks_into: null, alignment: [], role_ids: [], validity_months: 24, hours: 6 } as DefInput;
    await as('k-ro');
    expect((await b.rpc.saveMicrocredDef(base)).code).toBe('forbidden');
    await as('training-mgr');
    const s1 = await b.rpc.saveMicrocredDef(base);
    expect(s1.ok && s1.data!.version).toBe(1);
    expect((await b.rpc.saveMicrocredDef(base)).code).toBe('conflict');
    expect((await b.rpc.setMicrocredDefStatus(s1.data!.id, 'current', 'Pilot')).ok).toBe(true);
    const v2 = await b.rpc.saveMicrocredDef({ ...base, id: s1.data!.id, hours: 10, change_reason: 'More field time' });
    expect(v2.ok && v2.data!.version).toBe(2);
    expect((await b.rpc.setMicrocredDefStatus(v2.data!.id, 'current', null)).ok).toBe(true);
    const vs = b.raw('microcred_defs').filter((d) => d.code === 'MC-QA-AWARE').sort((x, y) => Number(x.version) - Number(y.version));
    expect(vs.map((d) => d.status)).toEqual(['superseded', 'current']);
    expect(vs[1].supersedes_id).toBe(s1.data!.id);
    expect((await b.rpc.setMicrocredDefStatus(v2.data!.id, 'retired', 'Pilot finished')).ok).toBe(true);
    expect((await b.rpc.setMicrocredDefStatus(v2.data!.id, 'retired', 'again')).code).toBe('conflict');
  });
  it('public verification shows initials only; statistics are exact for the training manager and suppressed below 10 for HR', async () => {
    const a = awards.find((x) => x.status === 'awarded' && x.person_id === 'p-k-ro')!;
    await as(null);
    const v = await b.rpc.verifyMicrocred(a.public_slug!);
    expect(v.ok && v.data!.found).toBe(true);
    expect(JSON.stringify(v.data)).not.toMatch(/p-k-ro|[a-z0-9.]+@[a-z]/);
    expect((await b.rpc.verifyMicrocred('mcnope')).code).toBe('not_found');
    await as('training-mgr');
    const st = await b.rpc.microcredStats();
    expect(st.allowed && st.exact).toBe(true);
    await as('chco');
    const agg = await b.rpc.microcredStats();
    expect(agg.allowed && !agg.exact && agg.rows.every((r) => r.holders === null || r.holders >= 10)).toBe(true);
    await as('k-ro');
    expect((await b.rpc.microcredStats()).allowed).toBe(false);
    expect((await b.rpc.microcredSweep()).code).toBe('forbidden');
  });
});

describe('F32 wiring', () => {
  it('route, supabase mapping and i18n keys', () => {
    const r = routes.find((x) => x.id === 'my-skills-credentials')!;
    expect(r.path).toBe('/my/skills/credentials');
    expect(r.guard.grant).toEqual({ res: 'skills_profile', levels: ['Own'] });
    for (const k of ['m17.routes.my-skills-credentials.title', 'm17.mc.admin.tab', 'm17.badge.kind.microcredential', 'm17.verify.status.renewal_due', 'm17.reasons.mc_part_missing']) expect(hasKey(k), k).toBe(true);
    const calls: string[] = [];
    const stub = async (fn: string) => { calls.push(fn); return { ok: true, code: 'ok', message: '', data: null }; };
    const x = { rpc: stub, call: stub };
    const s = makeSupabaseM17(x as never) as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
    void s.awardMicrocred('MC-X'); void s.verifyMicrocred('mcabc'); void s.saveMicrocredDef({}); void s.microcredSweep();
    expect(calls).toEqual(['kafaa_award_microcred', 'kafaa_verify_microcred', 'kafaa_save_microcred_def', 'kafaa_microcred_sweep']);
    expect(Object.keys(enJson.mc).sort()).toEqual(Object.keys(arJson.mc).sort());
  });
});
