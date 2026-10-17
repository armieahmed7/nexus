// @vitest-environment jsdom
/** [FS QA · wave I integration] Cross-feature wiring of FS78-FS84 on the integration branch, one test per integration criterion:
 *   routes            401 routes (380 after wave H + 21 wave-I routes), each wave-I path registered
 *   benchmarks        every wave-I page shows its card's FS01 benchmark chips
 *   FS79 -> M17       the trust tier is shown wherever M17 lists the credential: the wallet, the micro-credentials page, the learner record
 *                     (kind xcert, status = tier, shared and verified with its tier; gone once revoked) and the passport evidence drawer
 *   evidence labels   the passport names the wave-I evidence (certificate + tier, builder credit, grant output, consortium visit)
 *   3.9               certificate, builder, grant-output and visit evidence are recorded kinds that a recompute keeps (no redefinition)
 *   FS84 <- FS79      an unverified certificate never moves the organisation inventory or the data-quality figures
 *   FS81              transition plans: the person and HR only; a manager in scope reads nothing (settled decision, policy comment)
 *   FS80 <- FS36      every gallery entry names its AI-system register row
 *   FS78 <- FS30/FS18 the balance unit is the FS30 credit; study time is charged only to FS18 outcome-gated catalogue items
 *   FS82/FS83         budgets SIMULATED, partners synthetic; evidence ref_tables in the shared invariant lists
 *   entry links       FS84 from the skills outlook (HR only), FS83 from the energy academy, FS81 from the simulator page
 *   seed + migration  the fsqa9 finalizer passes on the final seed; the QA migration is additive (three FS32 helpers replaced) */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import seed from '../../src/seed/seed.json';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { applySkills } from '../../src/data/local/rpc.w0';
import { isRecordedEvidence } from '../../src/domain/skills';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { recordItems, ITEM_KINDS } from '../../src/modules/m17/learnerRecord';
import { trustTier, type CertLite } from '../../src/modules/m34/extcerts';
import { CREDIT_HOURS } from '../../src/modules/m34/balance';
import { CREDIT_HOURS as FS30_CREDIT_HOURS } from '../../src/modules/m34/credits';
import { useEvidenceLabel } from '../../src/modules/m17/PassportView';
import WalletPage from '../../src/modules/m17/WalletPage';
import MicrocredsPage from '../../src/modules/m17/MicrocredsPage';
import MyRecordPage from '../../src/modules/m17/MyRecordPage';
import SkillsOutlookPage from '../../src/modules/m07/SkillsOutlookPage';
import LearnAcademyPage from '../../src/modules/m04/LearnAcademyPage';
import TrainingSimulatorPage from '../../src/modules/m04/TrainingSimulatorPage';
// @ts-expect-error untyped seed builder (.mjs)
import { SHARED_EVIDENCE_LISTS, WAVE_I_REF_TABLES, recordWorldOf, finalize as fsqa9Finalize } from '../../scripts/seed/ext/fsqa9-integration.mjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = ((seed as any).tables ?? seed) as Record<string, Row[]>;
const W = { timeout: 60000 };
const QA = 'supabase/migrations/20261010299001_kafaa_fs9qa_integration.sql';
const WAVE_I: [string, string, string, string][] = [
  ['m34', 'my-learning-balance', '/my/learning-balance', 'FS78'], ['m34', 'team-study-time', '/team/study-time', 'FS78'], ['m34', 'workforce-learning-balances', '/workforce/learning-balances', 'FS78'],
  ['m34', 'my-external-certs', '/my/recognition/certificates', 'FS79'], ['m34', 'external-certs-queue', '/recognition/certificates', 'FS79'],
  ['m29', 'workforce-ai-automations', '/workforce/ai-automations', 'FS80'], ['m29', 'workforce-ai-automation', '/workforce/ai-automations/:id', 'FS80'], ['m29', 'my-ai-builds', '/my/ai-fluency/builds', 'FS80'],
  ['m29', 'admin-ai-automations', '/admin/ai-automations', 'FS80'],
  ['m30', 'my-transition-plan', '/my/transition-plan', 'FS81'], ['m30', 'workforce-transition-plans', '/workforce/transition-plans', 'FS81'], ['m30', 'workforce-transition-plan', '/workforce/transition-plans/:planId', 'FS81'],
  ['m30', 'workforce-rung-alerts', '/workforce/rung-alerts', 'FS81'],
  ['m36', 'my-grants', '/my/grants', 'FS82'], ['m36', 'ecosystem-grants', '/ecosystem/grants', 'FS82'], ['m36', 'workforce-grants', '/workforce/grants', 'FS82'],
  ['m36', 'ecosystem-consortium', '/ecosystem/consortium', 'FS83'], ['m36', 'ecosystem-consortium-cohort', '/ecosystem/consortium/:id', 'FS83'], ['m36', 'my-consortium', '/my/consortium', 'FS83'],
  ['m17', 'team-skills-future', '/team/skills/future', 'FS84'], ['m17', 'workforce-skills-inventory', '/workforce/skills-inventory', 'FS84'],
];
const pageFile = (m: string, id: string) => {
  const line = readFileSync(`src/modules/${m}/routes.ts`, 'utf8').split('\n').find((l) => l.includes(`id: '${id}'`))!;
  return `src/modules/${m}/${line.match(/import\('\.\/([^']+)'\)/)![1]}.tsx`;
};
const fresh = async (persona: string | null = null) => {
  const b = new LocalBackend(); await b.whenReady(); await b.reset();
  b.setPersona(persona); await b.whenReady();
  return b;
};
const as = async (b: LocalBackend, p: string | null) => { b.setPersona(p); await b.whenReady(); };
const onDay = (iso = '2026-10-12T05:00:00Z') => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(iso)); };

afterEach(() => { vi.useRealTimers(); });

describe('FS wave I · route registry', () => {
  it('401 routes, and the 21 wave-I routes are registered with their paths', async () => {
    const { ROUTES } = await import('../../src/routes/registry');
    const R = ROUTES as Row[];
    expect(R.length).toBe(404); // Help centre 2026-10-17: + 3 (help, help-glossary, help-guide). FS wave I QA: + 21 (FS78/FS79 M34 5, FS80 M29 4, FS81 M30 4, FS82/FS83 M36 6, FS84 M17 2)
    expect(WAVE_I.length).toBe(21);
    for (const [, id, path] of WAVE_I) expect(R.find((r) => r.id === id)?.path, id).toBe(path);
  });
});

describe('FS wave I · benchmarks', () => {
  it('every wave-I page shows its card benchmark chips (M30 through TpEyebrow); every chip id is a listed registry row with https sources', () => {
    for (const [m, id, , fs] of WAVE_I) {
      const src = readFileSync(pageFile(m, id), 'utf8');
      if (m === 'm30') expect(src.includes('<TpEyebrow />') || src.includes('TpEyebrow'), id).toBe(true);
      else expect(src, id).toContain(`<BenchmarkChips feature="${fs}" />`);
    }
    expect(readFileSync('src/modules/m30/ui.fs81.tsx', 'utf8')).toContain('<BenchmarkChips feature={FS81}');
    const bench = new Map(T.benchmarks.map((b) => [b.id, b]));
    for (const fs of ['FS78', 'FS79', 'FS80', 'FS81', 'FS82', 'FS83', 'FS84']) {
      expect(FEATURE_BENCHMARKS[fs]?.length, fs).toBeGreaterThan(0);
      for (const b of FEATURE_BENCHMARKS[fs]) expect(bench.get(b)?.listed && (bench.get(b)?.urls ?? []).length > 0, `${fs} ${b}`).toBe(true);
    }
  });
});

describe('FS wave I · FS79 -> M17 (trust tier wherever the credential appears)', () => {
  it('the wallet lists my external certificates with their trust tier (verified: the tier; waiting: claimed)', async () => {
    onDay();
    await renderPage(<WalletPage />, { persona: 'k-ro', path: '/my/skills/wallet' });
    const box = await screen.findByTestId('m17-xcerts', {}, W);
    await waitFor(() => expect(within(box).getAllByTestId('m17-xcert').length).toBe(2), W);
    const tiers = within(box).getAllByTestId('m17-xcert').map((el) => el.getAttribute('data-tier')).sort();
    expect(tiers).toEqual(['claimed', 'vendor_self_serve']);
    expect(within(box).getAllByTestId('m34-tier').length).toBe(2);
    expect(screen.getByTestId('m17-xcert-manage').getAttribute('href')).toMatch(/\/my\/recognition\/certificates$/);
  }, 120000);

  it('the micro-credentials page shows the same certificates with their tier', async () => {
    onDay();
    await renderPage(<MicrocredsPage />, { persona: 'sro', path: '/my/skills/credentials' });
    const box = await screen.findByTestId('m17-xcerts', {}, W);
    await waitFor(() => expect(within(box).getAllByTestId('m17-xcert').map((el) => el.getAttribute('data-tier'))).toEqual(['accredited']), W);
  }, 120000);

  it('the learner record lists a verified certificate as kind xcert whose status is its tier; shared, the verifier sees the tier; revoked, it leaves the record and the link', async () => {
    onDay();
    expect(ITEM_KINDS).toContain('xcert');
    for (const c of T.external_certs) {
      const items = recordItems(recordWorldOf(T, c.person_id, '2026-10-12'));
      const it = items.find((i) => i.ref === `xcert:${c.id}`);
      if (c.status === 'verified') expect(it?.status, c.id).toBe(trustTier(c as CertLite));
      else expect(it, c.id).toBeUndefined();
    }
    const b = await fresh('sro');
    const lr = await b.rpc.learnerRecord(null);
    const x = lr.items.find((i) => i.kind === 'xcert')!;
    expect(x.status).toBe('accredited');
    const share = await b.rpc.createRecordShare({ items: [x.ref], label: 'Secondment application', expires_on: '2026-11-11', consents: { items: true, preview: true, share: true } });
    expect(share.ok).toBe(true);
    const v = await b.rpc.verifyRecordShare(share.data!.token);
    const vr = ((v as Row).data ?? v) as Row;
    const vc = (vr.clr.credentialSubject.verifiableCredential as Row[])[0];
    expect(vr.clr.kafaaItems[0]).toMatchObject({ kind: 'xcert', status: 'accredited' });
    expect(vc.credentialSubject.kafaaTrustTier).toBe('accredited');
    expect(vc.credentialSubject.achievement.criteria.narrative).toMatch(/not the issuer and not an authority/);
    await as(b, 'training-mgr');
    expect((await b.rpc.verifyExternalCert({ id: x.id, decision: 'revoke', note: 'Issuer withdrew the certificate' } as never)).ok).toBe(true);
    await as(b, 'sro');
    expect((await b.rpc.learnerRecord(null)).items.some((i) => i.kind === 'xcert')).toBe(false);
    const v2 = await b.rpc.verifyRecordShare(share.data!.token);
    expect((((v2 as Row).data ?? v2) as Row).clr.kafaaItems.length).toBe(0);
  }, 120000);

  it('the learner record page shows the certificate card with the tier badge', async () => {
    onDay();
    await renderPage(<MyRecordPage />, { persona: 'sro', path: '/my/skills/record' });
    const rec = await screen.findByTestId('m17-lr-record', {}, W);
    const line = within(rec).getAllByTestId('m17-lr-item').find((el) => el.getAttribute('data-kind') === 'xcert')!;
    expect(line).toBeTruthy();
    expect(within(line).getByTestId('m34-tier').getAttribute('data-tier')).toBe('accredited');
  }, 120000);
});

describe('FS wave I · passport evidence labels', () => {
  it('the passport names certificate evidence with its issuer and tier, builder credit, grant outputs and consortium visits', async () => {
    const c = T.external_certs.find((x) => x.id === 'xc-p-sro-01');
    const d = { courses: [], quals: [], standards: [], training: [], attempts: [], forms: [], badges: [], mcAwards: [], xcerts: [c] } as Row;
    const rows = [
      { id: 'e1', kind: 'credential', ref_table: 'external_certs', ref_id: 'xc-p-sro-01' },
      { id: 'e2', kind: 'ojt', ref_table: 'automations', ref_id: 'atm-x' },
      { id: 'e3', kind: 'rating', ref_table: 'grant_applications', ref_id: 'ga-x' },
      { id: 'e4', kind: 'ojt', ref_table: 'consortium_visits', ref_id: 'cv-x' },
    ];
    function Probe() {
      const label = useEvidenceLabel(d);
      return <ul>{rows.map((e) => { const x = label(e); return <li key={e.id} data-testid={`probe-${e.id}`} data-tier={x.tier ?? ''}>{x.title}|{x.system}|{x.ref}</li>; })}</ul>;
    }
    await renderPage(<Probe />, { persona: 'sro' });
    const t1 = await screen.findByTestId('probe-e1', {}, W);
    expect(t1.textContent).toContain('External certificate · Graduate certificate in operational leadership');
    expect(t1.textContent).toContain(c.issuer);
    expect(t1.getAttribute('data-tier')).toBe('accredited');
    expect(screen.getByTestId('probe-e2').textContent).toMatch(/^Builder credit/);
    expect(screen.getByTestId('probe-e3').textContent).toMatch(/^Mobility micro-grant output/);
    expect(screen.getByTestId('probe-e4').textContent).toMatch(/^Consortium cross-site visit/);
    expect(readFileSync('src/modules/m17/PassportView.tsx', 'utf8')).toContain('{x.tier && <TrustTierBadge tier={x.tier} />}');
  }, 120000);
});

describe('FS wave I · recorded evidence (3.9)', () => {
  it('certificate, builder, grant-output and visit evidence are recorded kinds that a recompute keeps; no new RECORDED_REF_TABLES entry and no redefinition', async () => {
    for (const [rt, kind] of Object.entries(WAVE_I_REF_TABLES) as [string, string][]) expect(isRecordedEvidence({ kind, ref_table: rt }), rt).toBe(true);
    for (const e of T.skill_evidence.filter((x) => x.ref_table in WAVE_I_REF_TABLES)) expect(e.kind, e.id).toBe((WAVE_I_REF_TABLES as Row)[e.ref_table]);
    const b = await fresh(null);
    const sk = T.skills.find((k) => k.area !== 'security' && k.lifecycle !== 'retired')!.id;
    for (const [id, kind, rt] of [['se:q9:gr', 'rating', 'grant_applications'], ['se:q9:cv', 'ojt', 'consortium_visits'], ['se:q9:atm', 'ojt', 'automations']]) {
      b.rawInsert('skill_evidence' as never, { id, person_id: 'p-sro', skill_id: sk, kind, ref_table: rt, ref_id: `${rt}-q9`, level: 2, basis: 'validated', status: 'current', observed_on: '2026-10-12', note: 'fsqa9', recorded_by: 'p-chco', active: true, created_at: '2026-10-12T05:00:00Z', contractor: false } as never);
    }
    const xcBefore = (b.raw('skill_evidence' as never) as unknown as Row[]).filter((e) => e.ref_table === 'external_certs' && e.active).length;
    for (const p of ['p-sro', 'p-nse', 'p-buyer']) await applySkills(b, p, '2026-10-12');
    const ev = b.raw('skill_evidence' as never) as unknown as Row[];
    expect(ev.filter((e) => String(e.id).startsWith('se:q9:') && e.active).length).toBe(3);
    expect(ev.filter((e) => e.ref_table === 'external_certs' && e.active).length).toBe(xcBefore);
    for (const f of ['supabase/migrations/20261010291001_kafaa_fs91_balance_external_certs.sql', 'supabase/migrations/20261010292001_kafaa_fs92_automation_gallery.sql', 'supabase/migrations/20261010294001_kafaa_fs94_grants_consortium.sql', QA]) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/create or replace function kafaa_(skill_states_v2|skills_apply)\b/);
    }
  }, 120000);
});

describe('FS wave I · FS84 <- FS79', () => {
  it('an unverified certificate never moves the organisation inventory or the data-quality figures (only verified, evidenced or validated levels count)', async () => {
    onDay();
    const b = await fresh('chco');
    const before = JSON.stringify(await b.rpc.orgSkillInventory('entity' as never));
    await as(b, 'k-ro');
    const s = await b.rpc.submitExternalCert({ action: 'submit', title: 'Certificate in creative practice', issuer: 'Sample professional body (synthetic)', issuer_kind: 'professional_body', accreditation_ref: 'ACC-SAMPLE-1', credential_ref: 'UNIT-SAMPLE-9',
      issued_on: '2026-05-01', verification_url: 'https://certificates.example.org/verify/unit-sample-9', alignment_ids: ['al:sk-fs-tr-creative:esco:c624c6a3'], levels: { 'al:sk-fs-tr-creative:esco:c624c6a3': 3 } } as never);
    expect(s.ok).toBe(true);
    expect((b.raw('skill_evidence' as never) as unknown as Row[]).some((e) => e.ref_id === s.data!.id)).toBe(false);
    await as(b, 'chco');
    expect(JSON.stringify(await b.rpc.orgSkillInventory('entity' as never))).toBe(before);
  }, 120000);
});

describe('FS wave I · FS81 visibility (settled decision)', () => {
  it('transition plans are visible to the person and HR only: a manager in scope reads none of the team plans (table, plan view, board)', async () => {
    onDay();
    const schema = readFileSync('src/modules/m30/backend/schema.ts', 'utf8');
    const block = schema.slice(schema.indexOf('transition_plans: {'), schema.indexOf('transition_plans: {') + 1600);
    expect(block).toContain("read: [{ res: 'own_profile', person: 'person_id' }],");
    expect(readFileSync('src/auth/policy.ts', 'utf8')).toContain('FS81 transition plans are visible to the person and HR only');
    expect(readFileSync('src/auth/policy.ts', 'utf8')).not.toContain("managers their team's transition plans");
    const team = T.transition_plans.filter((p) => ['w-lo-02', 'w-ro-01', 'p-k-ro'].includes(p.person_id));
    expect(team.length).toBe(3);
    const b = await fresh('sro');
    const rows = (await b.list('transition_plans' as never)) as Row[];
    expect(rows.every((r) => r.person_id === 'p-sro')).toBe(true);
    for (const p of team) expect(await b.rpc.transitionPlanView(p.id), p.id).toBeNull();
    expect(await b.rpc.transitionPlans()).toBeNull();
    for (const persona of ['training-mgr', 'k-hr-analyst', 'k-auditor']) {
      await as(b, persona);
      expect(((await b.list('transition_plans' as never)) as Row[]).length, persona).toBe(0);
      expect(await b.rpc.transitionPlans(), persona).toBeNull();
    }
    await as(b, 'chco');
    expect((await b.rpc.transitionPlans())!.length).toBe(T.transition_plans.length);
  }, 120000);
});

describe('FS wave I · FS80 <- FS36', () => {
  it('every gallery entry names its AI-system register row (schema reference and seed)', () => {
    const systems = new Set(T.ai_systems.map((s) => s.id));
    expect(T.automations.length).toBeGreaterThan(0);
    for (const a of T.automations) expect(systems.has(a.system_id), a.id).toBe(true);
    expect(readFileSync('supabase/migrations/20261008120100_kafaa_schema.sql', 'utf8')).toContain('kafaa_automations_system_id_fk');
  });
});

describe('FS wave I · FS78 <- FS30/FS18', () => {
  it('the balance is shown in FS30 credit units, and every study-time request names an FS18 outcome-gated catalogue item', () => {
    expect(CREDIT_HOURS).toBe(FS30_CREDIT_HOURS);
    const xr = new Map(T.external_resources.map((x) => [x.id, x]));
    expect(T.study_time_requests.length).toBeGreaterThan(0);
    for (const r of T.study_time_requests) {
      const item = xr.get(r.resource_id);
      expect(item, r.id).toBeTruthy();
      if (r.status === 'approved') expect(item.status === 'published' && item.listed === true, r.id).toBe(true);
    }
    for (const lb of T.learning_balances) expect(Number(lb.remaining_hours), lb.id).toBe(Number(lb.granted_hours) - Number(lb.used_hours));
  });
});

describe('FS wave I · FS82/FS83 and the shared lists', () => {
  it('budgets are SIMULATED, consortium partners synthetic and labelled; the four wave-I evidence ref_tables are in the shared invariant lists', () => {
    for (const r of T.grant_rounds) expect(r.simulated, r.id).toBe(true);
    for (const id of ['org-cx-grid', 'org-cx-solar', 'org-cx-h2']) {
      const o = T.organisations.find((x) => x.id === id);
      expect(o?.synthetic === true && o?.public_listed === false && /\(synthetic\)/.test(o?.name_en) && /افتراضي/.test(o?.name_ar), id).toBe(true);
    }
    for (const f of SHARED_EVIDENCE_LISTS as string[]) for (const rt of Object.keys(WAVE_I_REF_TABLES)) expect(readFileSync(f, 'utf8'), `${f} ${rt}`).toContain(`'${rt}'`);
  });
});

describe('FS wave I · entry links', () => {
  it('the skills outlook links the organisation inventory for HR only (guarded); the energy academy links the consortium; the simulator page links rung alerts', async () => {
    onDay();
    await renderPage(<SkillsOutlookPage />, { persona: 'chco', path: '/workforce/skills-outlook' });
    expect((await screen.findByTestId('m07-so-to-inventory', {}, W)).getAttribute('href')).toMatch(/\/workforce\/skills-inventory$/);
    cleanup();
    await renderPage(<SkillsOutlookPage />, { persona: 'sro', path: '/workforce/skills-outlook' });
    await screen.findByTestId('m07-so-labels', {}, W);
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByTestId('m07-so-to-inventory')).toBeNull(); // a line manager may open the outlook but not the inventory
    cleanup();
    await renderPage(<LearnAcademyPage />, { persona: null, path: '/learn/academies/ac-energy', route: '/learn/academies/:academyId' });
    expect((await screen.findByTestId('m04-acad-to-consortium', {}, W)).querySelector('a')!.getAttribute('href')).toMatch(/\/ecosystem\/consortium$/);
    cleanup();
    await renderPage(<TrainingSimulatorPage />, { persona: 'training-mgr', path: '/training/simulator' });
    expect((await screen.findByTestId('m04-sim-to-rung-alerts', {}, W)).getAttribute('href')).toMatch(/\/workforce\/rung-alerts$/);
  }, 180000);
});

describe('FS wave I · seed finalizer and QA migration', () => {
  it('the fsqa9 finalizer passes on the final seed and changes no row', () => {
    const before = JSON.stringify([T.external_certs.length, T.skill_evidence.length, T.record_shares.length, T.team_skill_targets.length]);
    expect(() => fsqa9Finalize(T)).not.toThrow();
    expect(JSON.stringify([T.external_certs.length, T.skill_evidence.length, T.record_shares.length, T.team_skill_targets.length])).toBe(before);
  });
  it('is additive: three internal FS32 helpers replaced with their signatures and kept from API roles, no removal words, no data statement', () => {
    const sql = readFileSync(QA, 'utf8');
    expect(/\b(drop|delete|truncate)\b/i.test(sql)).toBe(false);
    const body = sql.replace(/--.*$/gm, '');
    const top = body.replace(/\$\$[\s\S]*?\$\$/g, "''");
    expect([...body.matchAll(/create or replace function (\w+)\(([^)]*)\)/g)].map((m) => `${m[1]}(${m[2]})`)).toEqual([
      'kafaa_lr_refs_ok(p text[])', 'kafaa_lr_items(p_person text, p_today date)', 'kafaa_lr_bundle(p_person text, p_refs text[], p_today date, p_id text, p_valid date)']);
    expect(/\balter\b|\bcreate (table|index|policy|trigger)\b|\binsert into\b|\bupdate\b|\bgrant\b/i.test(top)).toBe(false);
    expect(top).toContain('revoke execute on function kafaa_lr_items(text, date), kafaa_lr_bundle(text, text[], date, text, date) from public, anon, authenticated;');
  });
});
