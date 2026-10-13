/** FS78 Learning balance and protected study time + FS79 Verified import of external certificates (FS wave I · E1, M34): one named test
 *  per acceptance criterion on the local path, plus the rules shared with SQL, RBAC, the seed, routes, benchmarks and i18n. The SQL path
 *  (TS = SQL for grantFor, balanceOf, the gate, checkRequest, checkDecide, trustTier, certMapping, checkSubmit, checkVerify; RLS; live RPC
 *  flows; audit and ledger rows; DB checks; grants; additive SQL) is checked by scripts/validate/fs91-balance-external-certs.mjs (PGlite). */
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import en from '../../src/i18n/m34.en.json';
import ar from '../../src/i18n/m34.ar.json';
import seed from '../../src/seed/seed.json';
import { routes } from '../../src/modules/m34/routes';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { isRecordedEvidence } from '../../src/domain/skills';
import { BASE_HOURS, MID_CAREER_YEARS, SB_MSG, TOPUP_HOURS, balanceOf, balanceStats, checkRequest, grantFor, serviceYears } from '../../src/modules/m34/balance';
import { TIER_CAP, XC_MSG, certMapping, checkSubmit, issuerTier, maxBasisOf, trustTier, type AlignmentLite, type CertLite, type SkillLite } from '../../src/modules/m34/extcerts';
import { gatedResource } from '../../src/modules/m34/backend/local.fs91';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const S = seed as unknown as { tables: Record<string, Row[]> };
const T = S.tables;
const Y = new Date().toISOString().slice(0, 4);
const D = (m: number, d: number) => `${Y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const REQ = { hours: 10, starts_on: D(12, 1), ends_on: D(12, 18), pattern: 'release_days', reason: 'Systems thinking before the outage season' };
const CERT = {
  title: 'Certificate in creative practice', issuer: 'Sample professional body (synthetic)', issuer_kind: 'professional_body', accreditation_ref: 'ACC-SAMPLE-1', credential_ref: 'UNIT-SAMPLE-1',
  issued_on: '2026-05-01', verification_url: 'https://certificates.example.org/verify/unit-sample-1',
  alignment_ids: ['al:sk-fs-tr-creative:esco:c624c6a3', 'al:sk-fs-ai-automation:esco:f4a6e9f7'], levels: { 'al:sk-fs-tr-creative:esco:c624c6a3': 3, 'al:sk-fs-ai-automation:esco:f4a6e9f7': 2 },
};
const flat = (o: Row, p = ''): [string, string][] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));
const alMap = new Map(T.skill_alignments.map((a) => [a.id, a as AlignmentLite]));
const skMap = new Map(T.skills.map((k) => [k.id, k as SkillLite]));

let b: LocalBackend;
const as = async (p: string | null) => { b.setPersona(p); await b.whenReady(); };
const raw = (t: string) => (b.raw(t as never) as unknown as Row[]) ?? [];
const rawGet = (t: string, id: string) => b.rawGet(t as never, id) as unknown as Row | undefined;
const list = (t: string, filter?: Row) => b.list(t as never, filter ? { filter } as never : {}) as Promise<Row[]>;
beforeEach(async () => {
  b = new LocalBackend();
  await b.whenReady();
  await b.reset();
});

describe('FS78 acceptance', () => {
  it('FS78 acceptance: the balance equals grants minus approved use (TS rule = stored balance = rpc.learningBalance), before and after an approval', async () => {
    for (const row of T.learning_balances) {
      const v = balanceOf(row as never, T.study_time_requests as never);
      expect(v.granted_hours, row.id).toBe(row.base_hours + row.topup_hours);
      expect(v.used_hours, row.id).toBe(T.study_time_requests.filter((r) => r.person_id === row.person_id && r.status === 'approved').reduce((a, r) => a + r.hours, 0));
      expect([v.used_hours, v.pending_hours, v.remaining_hours], row.id).toEqual([row.used_hours, row.pending_hours, row.remaining_hours]);
      expect(v.remaining_hours).toBe(v.granted_hours - v.used_hours);
    }
    await as('k-ro');
    const v0 = (await b.rpc.learningBalance(null, null))!;
    expect(v0.balance.granted_hours).toBe(BASE_HOURS + TOPUP_HOURS);
    const r1 = await b.rpc.requestStudyTime({ action: 'request', resource_id: 'xr-openlearn-systems', ...REQ });
    expect(r1.ok).toBe(true);
    expect(r1.data!.line_manager_id).toBe('p-sro');
    expect(r1.data!.balance!.pending_hours).toBe(v0.balance.pending_hours + 10);
    await as('sro');
    const ok = await b.rpc.decideStudyTime({ id: r1.data!.id, decision: 'approve' });
    expect(ok.ok).toBe(true);
    await as('k-ro');
    const v1 = (await b.rpc.learningBalance(null, null))!;
    const stored = rawGet('learning_balances', `lb:p-k-ro:${Y}`)!;
    expect(v1.balance.used_hours).toBe(v0.balance.used_hours + 10);
    expect(v1.balance.remaining_hours).toBe(v1.balance.granted_hours - v1.balance.used_hours);
    expect([stored.used_hours, stored.pending_hours, stored.remaining_hours]).toEqual([v1.balance.used_hours, v1.balance.pending_hours, v1.balance.remaining_hours]);
    expect(balanceOf(stored as never, raw('study_time_requests') as never)).toEqual(v1.balance);
  }, 90000);

  it('FS78 acceptance: ungated items cannot be charged to the balance (draft, retired and non-catalogue items are refused)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const ung = T.external_resources.filter((x) => !gatedResource(x, T.catalogue_criteria, T.skills, today)).map((x) => x.id).sort();
    expect(ung).toEqual(['xr-enen2plus', 'xr-iaea-nuclear-security-elearning', 'xr-nea-nextgen-2026']);
    for (const r of T.study_time_requests) expect(gatedResource(T.external_resources.find((x) => x.id === r.resource_id), T.catalogue_criteria, T.skills, '2026-10-11'), r.id).toBe(true);
    await as('k-ro');
    const a0 = raw('audit_events').length;
    for (const id of ung) {
      const r = await b.rpc.requestStudyTime({ action: 'request', resource_id: id, ...REQ });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('ungated');
      expect(r.message).toBe(SB_MSG.ungated);
    }
    const c = await b.rpc.requestStudyTime({ action: 'request', resource_id: 'c-hu', ...REQ });
    expect(c.code).toBe('not_found');
    expect(raw('audit_events').length).toBe(a0 + 4);
    expect(raw('study_time_requests').filter((r) => ung.includes(r.resource_id)).length).toBe(0);
    expect(checkRequest(REQ, { today, person: { id: 'p', kind: 'staff', status: 'active' }, item: { id: 'x', hours: 10, gated: false }, available: 100, openSame: false, lineManager: 'm' })).toBe('ungated');
  }, 90000);

  it('FS78 acceptance: study-time decisions need a second person and write an audit row (maker-checker; approval also writes a ledger row)', async () => {
    await as('k-ro');
    const r = await b.rpc.requestStudyTime({ action: 'request', resource_id: 'xr-openlearn-systems', ...REQ });
    const id = r.data!.id;
    const self = await b.rpc.decideStudyTime({ id, decision: 'approve' });
    expect(self.code).toBe('maker_checker');
    expect(self.message).toBe(SB_MSG.self);
    for (const p of ['qc-inspector', 'training-mgr']) {
      await as(p);
      expect((await b.rpc.decideStudyTime({ id, decision: 'approve' })).code, p).toBe('not_found');
    }
    await as('sro');
    expect((await b.rpc.decideStudyTime({ id, decision: 'decline', note: 'no' })).message).toBe(SB_MSG.note);
    const a0 = raw('audit_events').length;
    const l0 = raw('ledger_local').length;
    const ok = await b.rpc.decideStudyTime({ id, decision: 'approve' });
    expect(ok.ok).toBe(true);
    const row = rawGet('study_time_requests', id)!;
    expect(row.status).toBe('approved');
    expect(row.decided_by).toBe('p-sro');
    expect(row.decided_by).not.toBe(row.person_id);
    const audit = raw('audit_events').slice(a0);
    expect(audit.length).toBe(1);
    expect(audit[0]).toMatchObject({ action: 'study.decide', entity_id: id, outcome: 'ok', actor_person_id: 'p-sro' });
    expect(raw('ledger_local').length).toBe(l0 + 1);
    for (const x of T.study_time_requests.filter((q) => q.decided_by)) expect(x.decided_by, x.id).not.toBe(x.person_id);
  }, 90000);

  it('the HR authority decides when the line manager cannot; the requester withdraws; over-balance requests are refused', async () => {
    await as('chco');
    const op = T.study_time_requests.find((r) => r.person_id === 'p-outage-planner' && r.status === 'requested')!;
    const h = await b.rpc.decideStudyTime({ id: op.id, decision: 'approve' });
    expect(h.ok).toBe(true);
    expect(rawGet('study_time_requests', op.id)!.decided_role).toBe('hr_director');
    await as('k-ro');
    const avail = (await b.rpc.learningBalance(null, null))!.balance.available_hours;
    const first = await b.rpc.requestStudyTime({ action: 'request', resource_id: 'xr-wnu-summer-institute', ...REQ, hours: 40 });
    expect(first.ok).toBe(true);
    const big = await b.rpc.requestStudyTime({ action: 'request', resource_id: 'xr-nea-nest', ...REQ, hours: avail - 40 + 1 });
    expect(big.code).toBe('insufficient_balance');
    expect(big.message).toBe(SB_MSG.balance);
    const pend = T.study_time_requests.find((r) => r.person_id === 'p-k-ro' && r.status === 'requested')!;
    await as('sro');
    expect((await b.rpc.requestStudyTime({ action: 'withdraw', id: pend.id })).code).toBe('forbidden');
    await as('k-ro');
    expect((await b.rpc.requestStudyTime({ action: 'withdraw', id: pend.id })).ok).toBe(true);
    expect(rawGet('learning_balances', `lb:p-k-ro:${Y}`)!.pending_hours).toBe(40); // only the 40-hour request above is still reserved
  }, 90000);

  it('RBAC (FS78): own balance; the line manager in scope; HR reads all; RPL assessors and other staff read none; anonymous nothing', async () => {
    await as(null);
    expect((await list('learning_balances')).length).toBe(0);
    expect((await list('study_time_requests')).length).toBe(0);
    await as('k-ro');
    expect((await list('learning_balances')).map((r) => r.person_id)).toEqual(['p-k-ro']);
    expect((await list('study_time_requests')).every((r) => r.person_id === 'p-k-ro')).toBe(true);
    await as('sro');
    expect((await list('study_time_requests', { person_id: 'p-k-ro' })).length).toBe(T.study_time_requests.filter((r) => r.person_id === 'p-k-ro').length);
    expect(await b.rpc.learningBalance('p-k-ro', null)).not.toBeNull();
    for (const p of ['training-mgr', 'k-instructor', 'qc-inspector']) {
      await as(p);
      expect((await list('learning_balances')).filter((r) => r.person_id !== b.identity().personId).length, p).toBe(0);
      expect(await b.rpc.learningBalance('p-k-ro', null), p).toBeNull();
    }
    for (const p of ['chco', 'k-hr-analyst', 'k-auditor']) {
      await as(p);
      expect((await list('learning_balances')).length, p).toBe(T.learning_balances.length);
    }
    await as('k-contractor');
    expect((await b.rpc.requestStudyTime({ action: 'request', resource_id: 'xr-openlearn-systems', ...REQ })).ok).toBe(false);
  }, 90000);

  it('the grant: 60 hours for staff, a 40-hour mid-career top-up from 8 years of service on 1 January, never from age, gender or nationality', () => {
    expect(serviceYears('2018-01-01', 2026)).toBe(8);
    expect(serviceYears('2018-01-02', 2026)).toBe(7);
    expect(grantFor({ id: 'a', kind: 'staff', status: 'active', hire_date: '2018-01-01' }, 2026)).toMatchObject({ granted_hours: 100, topup_basis: 'mid_career', service_years: MID_CAREER_YEARS });
    expect(grantFor({ id: 'a', kind: 'staff', status: 'active', hire_date: '2023-04-15' }, 2026)).toMatchObject({ granted_hours: 60, topup_hours: 0 });
    expect(grantFor({ id: 'a', kind: 'contractor', status: 'active', hire_date: '2010-01-01' }, 2026).granted_hours).toBe(0);
    expect(grantFor({ id: 'a', kind: 'staff', status: 'leaver', hire_date: '2010-01-01' }, 2026).eligible).toBe(false);
    const reads: string[] = [];
    const trap = new Proxy({ id: 'a', kind: 'staff', status: 'active', hire_date: '2015-03-01', gender: 'f', nationality_flag: 'uae', age: 41, birth_date: '1985-03-01' } as Row, {
      get(t, k) { if (['gender', 'nationality_flag', 'age', 'birth_date', 'age_band'].includes(String(k))) reads.push(String(k)); return t[k as string]; },
    });
    expect(grantFor(trap as never, 2026).topup_hours).toBe(40);
    expect(reads).toEqual([]);
    const staff = T.people.filter((p) => p.kind === 'staff' && p.status !== 'leaver');
    expect(T.learning_balances.length).toBe(staff.length);
    expect(T.learning_balances.every((r) => r.simulated === true && r.open_read === false)).toBe(true);
    const st = balanceStats(T.learning_balances as never, (pid) => T.learning_balances.find((x) => x.person_id === pid)!.entity_id ?? 'other', 10);
    for (const g of st) if (g.suppressed) { expect(g.people).toBeNull(); expect(g.used).toBeNull(); } else expect(g.people).toBeGreaterThanOrEqual(10);
    expect(st.some((g) => g.suppressed)).toBe(true);
  });

  it('the seed covers every request state, with both line-manager and HR decisions, inside every balance', () => {
    expect(new Set(T.study_time_requests.map((r) => r.status))).toEqual(new Set(['requested', 'approved', 'declined', 'withdrawn']));
    expect(T.study_time_requests.some((r) => r.decided_role === 'hr_director')).toBe(true);
    expect(T.study_time_requests.filter((r) => r.status === 'requested').every((r) => r.starts_on > '2026-10-18')).toBe(true);
    for (const row of T.learning_balances) expect(row.remaining_hours - row.pending_hours, row.id).toBeGreaterThanOrEqual(0);
  });
});

describe('FS79 acceptance', () => {
  it('FS79 acceptance: unverified certificates never become evidence above "claimed" (seed, submit, reject, revoke)', async () => {
    const ev = T.skill_evidence.filter((e) => e.ref_table === 'external_certs');
    expect(ev.length).toBe(9);
    for (const c of T.external_certs) {
      const mine = ev.filter((e) => e.ref_id === c.id && e.active);
      if (c.status !== 'verified') expect(mine.length, c.id).toBe(0);
      expect(maxBasisOf(c as CertLite)).toBe(c.status === 'verified' ? (issuerTier(c as CertLite) === 'enec_assessed' ? 'evidenced' : 'validated') : 'claimed');
    }
    expect(isRecordedEvidence({ kind: 'credential', ref_table: 'external_certs' })).toBe(true);
    await as('k-ro');
    const s = await b.rpc.submitExternalCert({ action: 'submit', ...CERT });
    expect(s.ok).toBe(true);
    expect(s.data!.tier).toBe('claimed');
    expect(raw('skill_evidence').filter((e) => e.ref_id === s.data!.id).length).toBe(0);
    await as('training-mgr');
    expect((await b.rpc.verifyExternalCert({ id: s.data!.id, decision: 'reject', note: 'x' })).message).toBe(XC_MSG.reason);
    expect((await b.rpc.verifyExternalCert({ id: s.data!.id, decision: 'reject', note: 'The issuer registry has no record of this number.' })).ok).toBe(true);
    expect(raw('skill_evidence').filter((e) => e.ref_id === s.data!.id).length).toBe(0);
    expect(trustTier(rawGet('external_certs', s.data!.id) as CertLite)).toBe('claimed');
    const rev = T.external_certs.find((c) => c.status === 'revoked')!;
    expect(rev.evidence_ids.length).toBeGreaterThan(0);
    expect(ev.filter((e) => rev.evidence_ids.includes(e.id)).every((e) => !e.active)).toBe(true);
  }, 90000);

  it('FS79 acceptance: verified imports map to skills only through reviewed crosswalk rows (basis and level by tier)', async () => {
    await as('k-ro');
    const s = await b.rpc.submitExternalCert({ action: 'submit', ...CERT });
    const id = s.data!.id;
    expect(s.data!.mapping!.rows.map((r) => r.state).sort()).toEqual(['maps', 'unreviewed']);
    await as('training-mgr');
    expect((await b.rpc.verifyExternalCert({ id, decision: 'verify', method: 'enec_assessment' })).message).toBe(XC_MSG.method_tier);
    const l0 = raw('ledger_local').length;
    const v = await b.rpc.verifyExternalCert({ id, decision: 'verify', method: 'issuer_registry' });
    expect(v.ok).toBe(true);
    expect(v.data!.tier).toBe('accredited');
    const ev = raw('skill_evidence').filter((e) => e.ref_table === 'external_certs' && e.ref_id === id);
    expect(ev.map((e) => [e.skill_id, e.kind, e.basis, e.level, e.active])).toEqual([['sk-fs-tr-creative', 'credential', 'validated', TIER_CAP.accredited, true]]);
    expect(raw('person_skills').find((p) => p.id === 'ps:p-k-ro:sk-fs-tr-creative')?.level).toBeGreaterThanOrEqual(2);
    expect(raw('ledger_local').length).toBe(l0 + 1);
    // every seeded verified certificate: evidence only on skills of reviewed rows it names, levels capped by its tier
    for (const c of T.external_certs.filter((x) => x.status === 'verified' || x.status === 'revoked')) {
      const m = certMapping(c, c.tier, alMap, skMap);
      expect(c.mapped, c.id).toEqual(m.rows);
      for (const k of m.skills) for (const a of k.alignment_ids) { const al = alMap.get(a)!; expect(al.status === 'published' && !!al.reviewed_by && !!al.reviewed_on, a).toBe(true); }
      expect(c.evidence_ids.length, c.id).toBe(m.skills.length);
    }
    // random crosswalk sets: an unreviewed row never maps
    const ids = T.skill_alignments.map((a) => a.id);
    for (let i = 0; i < 50; i++) {
      const pickIds = ids.filter((_, j) => (j * 7 + i * 13) % 37 === 0).slice(0, 5);
      for (const tier of ['enec_assessed', 'accredited', 'vendor_self_serve'] as const) {
        const m = certMapping({ alignment_ids: pickIds, levels: {} }, tier, alMap, skMap);
        for (const r of m.rows) if (r.state === 'maps') expect(alMap.get(r.alignment_id)!.reviewed_by).toBeTruthy();
        for (const k of m.skills) expect(k.level).toBeLessThanOrEqual(TIER_CAP[tier]);
      }
    }
  }, 90000);

  it('FS79 acceptance: the tier is visible wherever the credential appears (trustTier on every row and every RPC result; exported for M17)', async () => {
    const tiers = T.external_certs.map((c) => trustTier(c as CertLite));
    expect(new Set(tiers)).toEqual(new Set(['enec_assessed', 'accredited', 'vendor_self_serve', 'claimed']));
    for (const c of T.external_certs) expect((c.status === 'verified') === (trustTier(c as CertLite) !== 'claimed')).toBe(true);
    await as('k-ro');
    const s = await b.rpc.submitExternalCert({ action: 'submit', ...CERT });
    expect(s.data!.tier).toBe('claimed');
    const mine = await list('external_certs');
    expect(mine.every((c) => typeof trustTier(c as CertLite) === 'string')).toBe(true);
    await as('k-instructor');
    const v = await b.rpc.verifyExternalCert({ id: s.data!.id, decision: 'verify', method: 'issuer_url' });
    expect(v.data!.tier).toBe('accredited');
    await as('head-sq');
    const r = await b.rpc.verifyExternalCert({ id: s.data!.id, decision: 'revoke', note: 'Issuer withdrew it' });
    expect(r.data!.tier).toBe('claimed');
  }, 90000);

  it('maker-checker and refusals: the holder never verifies; staff cannot verify; https links only; security-area skills refused; duplicates refused', async () => {
    await as('chco');
    const own = await b.rpc.verifyExternalCert({ id: 'xc-p-chco-01', decision: 'verify', method: 'issuer_url' });
    expect(own.code).toBe('maker_checker');
    expect(own.message).toBe(XC_MSG.self);
    await as('k-ro');
    expect((await b.rpc.verifyExternalCert({ id: 'xc-p-k-ro-02', decision: 'verify', method: 'issuer_url' })).message).toBe(XC_MSG.forbidden_verify);
    expect((await b.rpc.submitExternalCert({ action: 'submit', ...CERT, verification_url: 'http://x.example.org/a' })).message).toBe(XC_MSG.url);
    const sec = T.skill_alignments.find((a) => T.skills.find((k) => k.id === a.skill_id)?.area === 'security');
    if (sec) expect((await b.rpc.submitExternalCert({ action: 'submit', ...CERT, alignment_ids: [sec.id], levels: {} })).code).toBe('security_restricted');
    expect((await b.rpc.submitExternalCert({ action: 'submit', ...CERT })).ok).toBe(true);
    expect((await b.rpc.submitExternalCert({ action: 'submit', ...CERT })).code).toBe('conflict');
    expect(checkSubmit({ ...CERT, alignment_ids: [] }, { today: '2026-10-12', alignments: alMap, skills: skMap, duplicate: false })).toBe('alignments');
  }, 90000);

  it('RBAC (FS79): holders read their own certificates; verifiers and auditors read all; other staff none', async () => {
    await as('k-ro');
    expect((await list('external_certs')).every((c) => c.person_id === 'p-k-ro')).toBe(true);
    for (const p of ['training-mgr', 'k-auditor']) {
      await as(p);
      expect((await list('external_certs')).length, p).toBe(T.external_certs.length);
    }
    await as('qc-inspector');
    expect((await list('external_certs')).filter((c) => c.person_id !== 'p-qc-inspector').length).toBe(0);
    await as(null);
    expect((await list('external_certs')).length).toBe(0);
  }, 90000);
});

describe('FS78/FS79 routes, benchmarks and i18n', () => {
  it('five routes with guards, EN and AR titles, the FS78/FS79 benchmarks, Arabic is Arabic', () => {
    const mine = ['my-learning-balance', 'team-study-time', 'workforce-learning-balances', 'my-external-certs', 'external-certs-queue'];
    expect(routes.filter((r) => mine.includes(r.id)).map((r) => r.path).sort()).toEqual(['/my/learning-balance', '/my/recognition/certificates', '/recognition/certificates', '/team/study-time', '/workforce/learning-balances']);
    const g = (id: string) => routes.find((r) => r.id === id)!.guard as Row;
    expect(g('my-learning-balance').grant).toEqual({ res: 'recognition', levels: ['Own'] });
    expect(g('team-study-time').grant).toEqual({ res: 'recognition', levels: ['Scope'] });
    expect(g('workforce-learning-balances').grant).toEqual({ res: 'workforce_strategy', levels: ['R', 'W', 'A'] });
    expect(g('external-certs-queue').grant).toEqual({ res: 'recognition', levels: ['A', 'R'] });
    for (const id of mine) { expect((en as Row).routes[id]?.title, id).toBeTruthy(); expect((ar as Row).routes[id]?.title, id).toBeTruthy(); }
    const B = FEATURE_BENCHMARKS as unknown as Record<string, string[]>;
    expect(B.FS78).toEqual(['ENTITLE']);
    expect(B.FS79).toEqual(['CORP', 'SKILLS-TECH', '1EDTECH']);
    const fe = new Map(['sb', 'xc', 'sbmsg', 'xcmsg'].flatMap((n) => flat((en as Row)[n], `${n}.`)));
    const fa = ['sb', 'xc', 'sbmsg', 'xcmsg'].flatMap((n) => flat((ar as Row)[n], `${n}.`));
    expect(fa.length).toBe(fe.size);
    for (const [k, v] of fa) { expect(v.trim(), k).not.toBe(''); if (/[A-Za-z]{4,}/.test(fe.get(k)!)) expect(/[؀-ۿ]/.test(v), k).toBe(true); }
    for (const k of Object.keys(SB_MSG)) expect((en as Row).sbmsg[k], k).toBe(SB_MSG[k]);
    for (const k of Object.keys(XC_MSG)) expect((en as Row).xcmsg[k], k).toBe(XC_MSG[k]);
  });
});
