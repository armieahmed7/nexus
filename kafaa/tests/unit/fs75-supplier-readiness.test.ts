/** FS68 Supplier future-skills readiness + FS69 Contractor pre-arrival check with selective disclosure (FS wave G · E5, fsGe5, M09):
 *  one named test per acceptance criterion on the local path, the card RBAC, the pure rules, the seed, the routes and i18n. The SQL path
 *  is checked by scripts/validate/fs75-supplier-readiness.mjs (PGlite: SQL = TS, RLS, the same flows). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { lintRanked } from '../../src/domain/engines';
import { precheck } from '../../src/modules/m09/contractor';
import { FR_GROUPS, frGroupOf, frPct, frRequirements, supplierFutureReadiness } from '../../src/modules/m09/futureReadiness';
import { PA_MSG, precheckFromShare, prearrivalProblem, sharedItems, sharedStates } from '../../src/modules/m09/prearrival';
import { recordItems } from '../../src/modules/m17/learnerRecord';
import { routes } from '../../src/modules/m09/routes';
import { makeSupabaseM09 } from '../../src/modules/m09/backend/supabase';
import seed from '../../src/seed/seed.json';
import arJson from '../../src/i18n/m09.ar.json';
import enJson from '../../src/i18n/m09.en.json';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
beforeEach(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); });
afterEach(() => { vi.useRealTimers(); });
const today = () => new Date().toISOString().slice(0, 10);
const plus = (d: number) => new Date(Date.parse(`${today()}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);
const raw = (t: string) => b.raw(t as never) as unknown as Row[];
const frWorld = () => ({ orgs: raw('organisations'), people: raw('people'), states: raw('person_skills'), skills: raw('skills') as never, comps: raw('competencies'), targets: raw('contract_role_targets'), profiles: raw('role_profile_versions'), roles: raw('job_roles'), courses: raw('courses') });
const rw = (pid: string) => ({ today: today(), person: pid, initials: String(b.rawGet('people', pid)?.initials ?? '—'), microcred_awards: raw('microcred_awards'), microcred_defs: raw('microcred_defs'), badges: raw('badges'), certificates: raw('certificates'), qual_records: raw('qual_records'), qual_standards: raw('qual_standards'), person_skills: raw('person_skills'), skills: raw('skills'), competencies: raw('competencies'), external_certs: raw('external_certs') }); // FS79 -> FS32 (wave I integration)
const audits = (action: string) => raw('audit_events').filter((a) => a.action === action);

describe('FS68 supplier future-skills readiness', () => {
  it('FS68 AC1: a partner sees only its own organisation', async () => {
    await as('alnoor-gm');
    const a = await b.rpc.supplierFutureReadiness();
    expect(a.allowed && a.scope).toBe('own');
    expect(a.orgs.map((o) => o.org_id)).toEqual(['org-alnoor']);
    await as('gulfhydro-qa');
    expect((await b.rpc.supplierFutureReadiness()).orgs.map((o) => o.org_id)).toEqual(['org-gulfhydro']);
    await as('k-contractor');
    expect((await b.rpc.supplierFutureReadiness()).orgs.map((o) => o.org_id)).toEqual(['org-dhafra']);
    await as('meridia-pd'); // international partner: not a supplier
    expect((await b.rpc.supplierFutureReadiness()).orgs).toEqual([]);
  });

  it('FS68 AC2: organisations under 10 people show suppressed values', async () => {
    await as('training-mgr');
    const r = await b.rpc.supplierFutureReadiness();
    const g = r.orgs.find((o) => o.org_id === 'org-gulfhydro')!;
    expect(g.suppressed).toBe(true);
    expect(g.n).toBeNull();
    expect(g.future_pct).toBeNull();
    expect(g.groups.every((x) => x.pct === null && x.bridge_pct === null)).toBe(true);
    expect(g.roles.every((x) => x.today_pct === null && x.future.every((f) => f.met === null && f.bridge === null && f.fresh === null && f.pct === null))).toBe(true);
    expect(r.orgs.filter((o) => !o.suppressed).every((o) => (o.n ?? 0) >= 10)).toBe(true);
    // the same organisation with 10 contractors shows its values (pure rule)
    const w = frWorld();
    const extra = Array.from({ length: 2 }, (_, i) => ({ id: `zz-${i}`, kind: 'contractor', status: 'active', org_id: 'org-gulfhydro' }));
    const shown = supplierFutureReadiness({ ...w, people: [...w.people, ...extra] }, ['org-gulfhydro'])[0];
    expect(shown.suppressed).toBe(false);
    expect(shown.n).toBe(11);
  });

  it('FS68 AC3: course suggestions carry reasons from the existing F33 engine', async () => {
    await as('k-instructor');
    const r = await b.rpc.supplierFutureReadiness();
    const f33Codes = new Set<string>();
    for (const std of ['qs-mech', 'qs-rp', 'qs-qa', 'qs-ic']) {
      const p = precheck({ person_id: 'c-alnoor-01', standard: b.rawGet('qual_standards', std)!, tasks: raw('task_items'), links: raw('task_skill_links'), states: raw('person_skills').filter((s) => s.person_id === 'c-alnoor-01'), skills: raw('skills') as never, comps: raw('competencies'), requests: [], courses: raw('courses') });
      for (const s of p.suggestions) for (const x of s.reasons) f33Codes.add(x.code);
    }
    for (const o of r.orgs) {
      expect(o.suggestions.length).toBeGreaterThan(0);
      expect(lintRanked(o.suggestions as never)).toEqual([]);
      for (const s of o.suggestions) {
        expect(['academy_course', 'enec_course']).toContain(s.reasons[0].code);
        expect(s.reasons.slice(1).every((x) => x.code === 'closes_gap')).toBe(true);
        expect(s.reasons.every((x) => f33Codes.has(x.code) && x.key === `m09.reasons.${x.code}`)).toBe(true);
      }
    }
  });

  it('FS68 RBAC: ENEC evaluators, auditors and supplier management see every supplier; staff see nothing', async () => {
    for (const p of ['training-mgr', 'k-instructor', 'k-auditor', 'k-admin']) {
      await as(p);
      const r = await b.rpc.supplierFutureReadiness();
      expect(r.scope).toBe('all');
      expect(r.orgs.map((o) => o.org_id)).toEqual(['org-alnoor', 'org-dhafra', 'org-gulfhydro']);
    }
    await as('sro');
    expect(await b.rpc.supplierFutureReadiness()).toMatchObject({ allowed: false, orgs: [] });
    await as(null);
    expect((await b.rpc.supplierFutureReadiness()).allowed).toBe(false);
  });

  it('FS68 rules: future needs are the 2030 requirements today does not ask for; groups; met / bridge / new on recorded levels only', () => {
    const reqs = frRequirements(T.role_profile_versions.find((v) => v.id === 'rpv-quality-assurance-qc-2030-v1'), T.role_profile_versions.find((v) => v.id === 'rpv-quality-assurance-qc-now-v1'));
    expect(reqs.filter((r) => r.future).map((r) => r.ref_id)).toEqual(['sk-da-01', 'sk-fs-ai-verify']);
    expect(reqs.filter((r) => !r.future).every((r) => r.kind === 'competency')).toBe(true);
    const sk = (id: string) => T.skills.find((s) => s.id === id);
    expect(frGroupOf('skill', 'sk-fs-cy-phishing', sk('sk-fs-cy-phishing'))).toBe('cyber_hygiene');
    expect(frGroupOf('skill', 'sk-fs-ai-verify', sk('sk-fs-ai-verify'))).toBe('ai_literacy');
    expect(frGroupOf('skill', 'sk-fs-dp-dic', sk('sk-fs-dp-dic'))).toBe('digital');
    expect(frGroupOf('skill', 'sk-en-02-perf', sk('sk-en-02-perf'))).toBe('other_future');
    expect(frGroupOf('competency', 'da-02', undefined)).toBe('ai_literacy');
    expect(FR_GROUPS).toEqual(['digital', 'ai_literacy', 'cyber_hygiene', 'other_future']);
    expect([frPct(1, 3), frPct(1, 2), frPct(0, 0), frPct(2, 3)]).toEqual([33, 50, 0, 67]);
    // a tiny world: one org, 10 contractors; one holds the skill at 2 (met), one at 1 (bridge), one self-claims it (does not count)
    const people = Array.from({ length: 10 }, (_, i) => ({ id: `x-${i}`, kind: 'contractor', status: 'active', org_id: 'org-x' }));
    const states = [
      { person_id: 'x-0', skill_id: 'sk-fs-ai-verify', level: 2, basis: 'evidenced', active: true },
      { person_id: 'x-1', skill_id: 'sk-fs-ai-verify', level: 1, basis: 'evidenced', active: true },
      { person_id: 'x-2', skill_id: 'sk-fs-ai-verify', level: 3, basis: 'claimed', active: true },
      { person_id: 'x-3', skill_id: 'sk-fs-ai-use', level: 2, basis: 'validated', active: true },
    ];
    const w = { orgs: [{ id: 'org-x', kind: 'supplier', name_en: 'X', name_ar: 'X' }], people, states, skills: T.skills as never, comps: T.competencies, courses: T.courses, roles: T.job_roles, profiles: T.role_profile_versions,
      targets: [{ id: 't', org_id: 'org-x', role_id: 'quality-assurance-qc', headcount_band: '10-24', active: true }] };
    const o = supplierFutureReadiness(w, null)[0];
    const ai = o.roles[0].future.find((f) => f.ref_id === 'sk-fs-ai-verify')!;
    expect([ai.met, ai.bridge, ai.fresh, ai.pct]).toEqual([1, 2, 7, 10]); // x-3 bridges through the adjacent sk-fs-ai-use
    expect(o.academy_gaps.map((g) => g.skill_id)).toContain('sk-fs-ai-verify');
  });

  it('FS68 seed and data: three supplier organisations with contracted roles, each role with a published 2030 profile; nothing stored', () => {
    const r = supplierFutureReadiness({ orgs: T.organisations, people: T.people, states: T.person_skills, skills: T.skills as never, comps: T.competencies, targets: T.contract_role_targets, profiles: T.role_profile_versions, roles: T.job_roles, courses: T.courses }, null);
    expect(r.map((o) => [o.org_id, o.suppressed])).toEqual([['org-alnoor', false], ['org-dhafra', false], ['org-gulfhydro', true]]);
    expect(r.every((o) => o.roles.every((x) => x.profile_id && x.future.length > 0))).toBe(true);
    expect(r.flatMap((o) => o.roles.flatMap((x) => x.future.map((f) => f.group)))).toEqual(expect.arrayContaining(['digital', 'ai_literacy', 'other_future']));
    expect(r.filter((o) => !o.suppressed).every((o) => o.roles.some((x) => (x.bridge_pct ?? 0) > 0))).toBe(true);
  });
});

describe('FS69 contractor pre-arrival check', () => {
  const share = (id: string) => b.rawGet('record_shares' as never, (b.rawGet('prearrival_shares' as never, id) as unknown as Row).share_id) as unknown as Row;

  it('FS69 AC1: only shared items are visible to the evaluator', async () => {
    await as('k-instructor');
    const list = await b.rpc.prearrivalShares();
    expect(list.length).toBe(T.prearrival_shares.length);
    expect(list.every((x) => !('items' in x) && !('token' in x))).toBe(true);
    const d = await b.rpc.prearrivalShare('pa-calnoor01-mech');
    expect(d.ok).toBe(true);
    const refs = share('pa-calnoor01-mech').items as string[];
    expect(d.data!.items.map((i) => i.ref).sort()).toEqual([...refs].sort());
    const held = recordItems(rw('c-alnoor-01')).map((i) => i.ref);
    const hidden = held.filter((r) => !refs.includes(r));
    expect(hidden.length).toBeGreaterThan(0);
    expect(JSON.stringify(d.data)).not.toContain(hidden[0]);
    const run = await b.rpc.precheckFromShare('pa-calnoor01-mech');
    expect(run.ok).toBe(true);
    expect(run.data!.skills_used).toBe(refs.length);
    expect(run.data!.shared.map((i) => i.ref).sort()).toEqual([...refs].sort());
    // every task link reads only shared skills: an unshared held skill (sk-mp-02, I&C) shows as not held
    const linkSkills = new Set(run.data!.tasks.flatMap((t) => t.links.filter((l) => l.have > 0).map((l) => l.skill_id)));
    expect([...linkSkills].every((s) => refs.includes(`skill:${s}`))).toBe(true);
    // evaluators cannot read the FS32 share rows (items, token) directly
    expect((await b.list('record_shares' as never, { filter: { person_id: 'c-alnoor-01' } } as never)).length).toBe(0);
    // a partner admin lists their organisation's shares but cannot open the shared items
    await as('alnoor-gm');
    expect((await b.rpc.prearrivalShares()).every((x) => x.org_id === 'org-alnoor')).toBe(true);
    expect((await b.rpc.prearrivalShare('pa-calnoor01-mech')).code).toBe('not_found');
  });

  it('FS69 AC2: the link expires as set', async () => {
    await as('k-instructor');
    const ex = await b.rpc.prearrivalShare('pa-cdhafra06-rp');
    expect(ex.data!.status).toBe('expired');
    expect(ex.data!.items).toEqual([]);
    expect((await b.rpc.precheckFromShare('pa-cdhafra06-rp')).code).toBe('expired');
    // a new link set to expire in 3 days works until that day and is refused the day after
    await as('k-contractor');
    const items = recordItems(rw('p-k-contractor')).filter((i) => i.kind === 'skill').slice(0, 3).map((i) => i.ref);
    const c = await b.rpc.createPrearrivalShare({ items, label: 'Short notice call-out', expires_on: plus(3), mobilise_on: plus(2), consents: { items: true, preview: true, share: true }, standard_id: 'qs-mech' });
    expect(c.ok).toBe(true);
    await as('k-instructor');
    expect((await b.rpc.precheckFromShare(c.data!.id)).ok).toBe(true);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${plus(3)}T12:00:00Z`));
    expect((await b.rpc.precheckFromShare(c.data!.id)).ok).toBe(true); // still the expiry day
    vi.setSystemTime(new Date(`${plus(4)}T08:00:00Z`));
    expect((await b.rpc.precheckFromShare(c.data!.id)).code).toBe('expired');
    expect((await b.rpc.prearrivalShare(c.data!.id)).data!.items).toEqual([]);
    vi.useRealTimers();
    // expiry rules: 1-90 days and not before mobilisation
    const avail = recordItems(rw('p-k-contractor'));
    const base = { items, label: 'Test share', expires_on: plus(10), mobilise_on: plus(5), consents: { items: true, preview: true, share: true }, standard_id: 'qs-mech' };
    expect(prearrivalProblem(base, avail, today(), false)).toBe('ok');
    expect(prearrivalProblem({ ...base, expires_on: plus(91), mobilise_on: plus(5) }, avail, today(), false)).toBe('invalid');
    expect(prearrivalProblem({ ...base, mobilise_on: plus(11) }, avail, today(), false)).toBe('mobilise');
    expect(prearrivalProblem({ ...base, mobilise_on: plus(-1) }, avail, today(), false)).toBe('mobilise');
  });

  it('FS69 AC3: the pre-check result writes no evidence and no qualification status', async () => {
    const snap = () => JSON.stringify(['skill_evidence', 'person_skills', 'qual_records', 'evaluations', 'equivalency_requests'].map((t) => raw(t)));
    const before = snap();
    await as('training-mgr');
    for (const id of ['pa-calnoor01-mech', 'pa-cgulf03-ic', 'pa-cdhafra04-rp', 'pa-kcontractor-mech', 'pa-cdhafra05-mech']) {
      const r = await b.rpc.precheckFromShare(id);
      expect(r.ok).toBe(true);
      expect(r.message).toBe(PA_MSG.check_ok);
    }
    expect(snap()).toBe(before);
    const row = b.rawGet('prearrival_shares' as never, 'pa-calnoor01-mech') as unknown as Row;
    expect(row.checked_by).toBe('p-training-mgr');
    expect(Object.keys(row.check_summary).sort()).toEqual(['coverage', 'critical_gaps', 'gaps', 'likely', 'outlook', 'partial', 'skills_used', 'standard_id', 'total']);
    expect(audits('prearrival.precheck').length).toBe(5);
    expect(raw('ledger_local').some((l) => String(l.action).includes('prearrival.precheck'))).toBe(false);
  });

  it('FS69 RBAC: contractor Own creates; an evaluator records on behalf only with the consent reference; others refused', async () => {
    await as('k-contractor');
    const avail = recordItems(rw('p-k-contractor'));
    const input = { items: avail.slice(0, 2).map((i) => i.ref), label: 'Outage support', expires_on: plus(30), mobilise_on: plus(20), consents: { items: true, preview: true, share: true }, standard_id: 'qs-mech' };
    const self = await b.rpc.createPrearrivalShare(input);
    expect(self.ok).toBe(true);
    const row = b.rawGet('prearrival_shares' as never, self.data!.id) as unknown as Row;
    expect([row.created_via, row.org_id, row.person_id]).toEqual(['self', 'org-dhafra', 'p-k-contractor']);
    expect((b.rawGet('record_shares' as never, self.data!.share_id) as unknown as Row).token).toBe(self.data!.token);
    expect((await b.rpc.prearrivalShares()).every((x) => x.person_id === 'p-k-contractor')).toBe(true);
    const items2 = recordItems(rw('c-alnoor-02')).slice(0, 2).map((i) => i.ref);
    const behalf = { ...input, person_id: 'c-alnoor-02', items: items2 };
    await as('training-mgr');
    expect((await b.rpc.createPrearrivalShare(behalf)).code).toBe('consent_ref');
    const ok = await b.rpc.createPrearrivalShare({ ...behalf, consent_ref: 'ALN-CF-UNIT-01' });
    expect(ok.ok).toBe(true);
    expect((b.rawGet('prearrival_shares' as never, ok.data!.id) as unknown as Row).created_via).toBe('on_behalf');
    expect(b.rawGet('notifications', `nt-pa-${ok.data!.id}-created`)?.person_id).toBe('c-alnoor-02');
    expect(raw('ledger_local').some((l) => l.action === 'kafaa.prearrival.share')).toBe(true);
    await as('alnoor-gm');
    expect((await b.rpc.createPrearrivalShare({ ...behalf, consent_ref: 'X-1-2' })).code).toBe('forbidden');
    await as('sro');
    expect((await b.rpc.createPrearrivalShare(input)).code).toBe('forbidden');
    await as('k-auditor');
    expect((await b.rpc.precheckFromShare('pa-calnoor01-mech')).code).toBe('forbidden');
    expect((await b.rpc.prearrivalShare('pa-calnoor01-mech')).ok).toBe(true);
    await as('k-instructor');
    expect((await b.rpc.createPrearrivalShare({ ...behalf, person_id: 'p-sro', consent_ref: 'X-1-2' })).code).toBe('not_found');
    expect((await b.rpc.createPrearrivalShare({ ...behalf, consent_ref: 'ALN-2', items: ['skill:sk-ld-02'] })).code).toBe('not_shareable');
    expect((await b.rpc.createPrearrivalShare({ ...behalf, consent_ref: 'ALN-2', standard_id: 'qs-nope' })).code).toBe('not_found');
  });

  it('FS69 revoke: the contractor at any time; an evaluator on request with a reason; a revoked link shows nothing', async () => {
    await as('k-contractor');
    expect((await b.rpc.revokePrearrivalShare('pa-kcontractor-mech')).ok).toBe(true);
    expect((await b.rpc.revokePrearrivalShare('pa-kcontractor-mech')).code).toBe('already_closed');
    await as('k-instructor');
    expect((await b.rpc.precheckFromShare('pa-kcontractor-mech')).code).toBe('revoked');
    expect((await b.rpc.revokePrearrivalShare('pa-calnoor01-mech', '')).code).toBe('invalid');
    expect((await b.rpc.revokePrearrivalShare('pa-calnoor01-mech', 'Contractor asked by phone')).ok).toBe(true);
    expect((await b.rpc.prearrivalShare('pa-calnoor01-mech')).data).toMatchObject({ status: 'revoked', items: [], revoke_reason: 'Contractor asked by phone' });
    await as('alnoor-gm');
    expect((await b.rpc.revokePrearrivalShare('pa-calnoor05-qa', 'x y z')).code).toBe('not_found');
  });

  it('FS69 rule: the pre-check uses only shared skill states and no prior equivalency requests; the seeded summaries reproduce', () => {
    for (const r of T.prearrival_shares.filter((x) => x.check_summary)) {
      const s = T.record_shares.find((x) => x.id === r.share_id)!;
      const w = { today: '2026-10-11', person: r.person_id, initials: '', microcred_awards: T.microcred_awards, microcred_defs: T.microcred_defs, badges: T.badges, certificates: T.certificates, qual_records: T.qual_records, qual_standards: T.qual_standards, person_skills: T.person_skills, skills: T.skills, competencies: T.competencies };
      const shared = sharedItems(recordItems(w), s.items);
      expect(sharedStates(r.person_id, shared).length).toBe(shared.filter((i) => i.kind === 'skill').length);
      const p = precheckFromShare(r.id, r.person_id, shared, { standard: T.qual_standards.find((q) => q.id === r.standard_id)!, tasks: T.task_items, links: T.task_skill_links, skills: T.skills as never, comps: T.competencies, courses: T.courses });
      expect(p.prior_request_id).toBeNull();
      expect({ likely: p.likely, total: p.total, outlook: p.outlook, coverage: p.coverage, skills_used: p.skills_used }).toMatchObject({ likely: r.check_summary.likely, total: r.check_summary.total, outlook: r.check_summary.outlook, coverage: r.check_summary.coverage, skills_used: r.check_summary.skills_used });
    }
  });

  it('FS69 seed: active, expired and revoked links; self and on behalf with consent references; synthetic contractors only', () => {
    const view = (r: Row) => { const s = T.record_shares.find((x) => x.id === r.share_id)!; return s.revoked_at ? 'revoked' : s.expires_on < today() ? 'expired' : 'active'; };
    expect(T.prearrival_shares.length).toBe(7);
    expect(new Set(T.prearrival_shares.map(view))).toEqual(new Set(['active', 'expired', 'revoked']));
    expect(T.prearrival_shares.filter((r) => r.created_via === 'on_behalf').every((r) => r.consent_ref.length >= 3)).toBe(true);
    expect(T.prearrival_shares.every((r) => T.people.find((p) => p.id === r.person_id)?.kind === 'contractor')).toBe(true);
    expect(T.record_shares.filter((s) => s.id.startsWith('rs-pa-')).every((s) => s.consents.purpose === 'prearrival')).toBe(true);
  });
});

describe('FS68/FS69 wiring', () => {
  it('routes, guards and the smoke parameter', () => {
    const r = (id: string) => routes.find((x) => x.id === id)!;
    expect(r('partner-future-readiness').guard).toEqual({ signedIn: true, anyRole: ['partner_admin', 'partner_user'] });
    expect(r('admin-supplier-future-readiness').guard.anyRole).toEqual(['admin', 'auditor', 'training_manager', 'instructor']);
    expect(r('partner-prearrival').path).toBe('/partner/workforce/prearrival');
    expect(r('training-equivalency-prearrival').guard.anyRole).toEqual(['instructor', 'training_manager', 'auditor']);
    expect(r('training-equivalency-prearrival-share').path).toBe('/training/equivalency/prearrival/:shareId');
  });
  it('the Supabase backend maps every RPC to its kafaa_* function', async () => {
    const calls: string[] = [];
    const x = { call: async (fn: string) => { calls.push(fn); return { ok: true, code: 'ok', message: '' }; }, rpc: async (fn: string) => { calls.push(fn); return []; } };
    const s = makeSupabaseM09(x as never);
    await s.supplierFutureReadiness(); await s.prearrivalShares(); await s.prearrivalContractors(); await s.prearrivalItems(null);
    await s.createPrearrivalShare({} as never); await s.revokePrearrivalShare('x'); await s.prearrivalShare('x'); await s.precheckFromShare('x');
    expect(calls).toEqual(['kafaa_supplier_future_readiness', 'kafaa_prearrival_shares', 'kafaa_prearrival_contractors', 'kafaa_prearrival_items', 'kafaa_create_prearrival_share', 'kafaa_revoke_prearrival_share', 'kafaa_prearrival_share', 'kafaa_precheck_from_share']);
  });
  it('every reason code and page text exists in English and Arabic', () => {
    const en = enJson as Row; const ar = arJson as Row;
    for (const c of ['fr_req_met', 'fr_req_bridge', 'fr_req_new', 'fr_req_suppressed', 'fr_no_future', 'fr_no_profile']) { expect(en.reasons[c]).toBeTruthy(); expect(ar.reasons[c]).toBeTruthy(); }
    for (const id of ['partner-future-readiness', 'admin-supplier-future-readiness', 'partner-prearrival', 'training-equivalency-prearrival', 'training-equivalency-prearrival-share']) expect(ar.routes[id].title).toBeTruthy();
    expect(Object.keys(ar.fr).sort()).toEqual(Object.keys(en.fr).sort());
    expect(Object.keys(ar.pa).sort()).toEqual(Object.keys(en.pa).sort());
    expect(JSON.stringify(en.pa) + JSON.stringify(en.fr)).not.toMatch(/\bFANR (certifies|certified|approves)\b/);
  });
});
