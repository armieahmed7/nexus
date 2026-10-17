// @vitest-environment jsdom
/** [FS QA · wave D integration] Cross-feature wiring of FS27-FS37 on master, one test per integration criterion:
 *   routes      288 routes after wave D (259 after wave C + 29 wave-D routes; 315 after wave E, 338 after wave F, 367 after wave G, 380 after wave H, 401 after wave I), each wave-D path registered
 *   benchmarks  every wave-D page names its card's FS01 benchmark chips; every chip is a published row with an https source and an as-of date
 *   FS31-FS27   a gig that names a strategic credential refuses a non-holder (credential_required) and accepts a holder; ungated gigs unchanged;
 *               the apply card shows the gate (unlocked / locked, with links to the credential)
 *   FS31-FS27/8 the strategic tier also names wave-D channel gigs and future-role rotations
 *   FS31-FS30   every current micro-credential has an indicative credit tag; FS31 awards count in the credit ledger (creditsFor)
 *   FS27-FS17   the gap backlog keeps its 215 rows: open = requested steps; practice steps the channel gigs fill are kept as filled
 *   FS07-FS33   a goal set on a skill page links to "Skills I want to grow" to add a target date
 *   migration   the QA migration is additive (one function replaced, inserts on conflict do nothing, guarded gap updates) */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cleanup, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderPage } from './g1-harness';
import seed from '../../src/seed/seed.json';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { resolvePathway, type Content } from '../../src/modules/m19/pathways';
import { FS31_CODES, targetCheck } from '../../src/modules/m17/futureCreds';
import { creditsFor } from '../../src/modules/m34/credits';
import OpportunityPage from '../../src/modules/m20/OpportunityPage';
import SkillPage from '../../src/modules/m28/SkillPage';
// @ts-expect-error untyped seed builder (.mjs)
import { FSQA4_UNLOCKS as UNLOCKS0 } from '../../scripts/seed/ext/fsqa4-integration.mjs';
const FSQA4_UNLOCKS = UNLOCKS0 as [string, string, string, string, string][];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = ((seed as any).tables ?? seed) as Record<string, Row[]>;
const W = { timeout: 60000 };
const TODAY = new Date().toISOString().slice(0, 10);
const WAVE_D: [string, string, string[]][] = [
  ['/opportunities/future', 'm20/FutureGigsPage.tsx', ['FS27']], ['/opportunities/envelope', 'm20/EnvelopePage.tsx', ['FS27']], ['/opportunities/envelopes', 'm20/TeamEnvelopesPage.tsx', ['FS27']],
  ['/opportunities/rotations/future', 'm20/FutureRotationsPage.tsx', ['FS28']], ['/opportunities/secondments', 'm20/SecondmentsPage.tsx', ['FS28']], ['/opportunities/secondments/hr', 'm20/SecondmentDeskPage.tsx', ['FS28']],
  ['/recognition', 'm34/RecognitionPage.tsx', ['FS29', 'FS30']], ['/my/recognition', 'm34/MyRecognitionPage.tsx', ['FS29', 'FS30']], ['/my/recognition/rpl/:id', 'm34/RplRequestPage.tsx', ['FS29', 'FS30']],
  ['/my/credits', 'm34/MyCreditsPage.tsx', ['FS29', 'FS30']], ['/recognition/review', 'm34/RplQueuePage.tsx', ['FS29', 'FS30']], ['/recognition/review/:id', 'm34/RplReviewPage.tsx', ['FS29', 'FS30']],
  ['/admin/credit-tags', 'm34/CreditTagsPage.tsx', ['FS29', 'FS30']],
  ['/my/skills/goals', '', ['FS33']], ['/team/skills/goals', '', ['FS33']], ['/my/skills/record', '', ['FS32']], ['/verify/record/:token', '', ['FS32']],
  ['/my/skills/credentials/future', '', ['FS31']], ['/my/skills/credentials/c/:code', '', ['FS31']], ['/training/credentials/strategic', '', ['FS31']],
  ['/careers/translate', 'm18/CareersTranslatePage.tsx', ['FS34']], ['/my/career/health', 'm18/MyCareerHealthPage.tsx', ['FS35']],
  ['/workforce/ai-register', '', ['FS36']], ['/workforce/ai-register/:id', '', ['FS36']], ['/workforce/ai-literacy-pack', '', ['FS36']], ['/admin/ai-register', '', ['FS36']],
  ['/my/ai-fluency/drills', '', ['FS37']], ['/my/ai-fluency/drills/:id', '', ['FS37']], ['/training/ai-drills', '', ['FS37']],
];

/** The component file a route lazily imports (routes.ts `component: lazy(() => import('./X'))`). */
function componentOf(path: string): string {
  for (const m of ['m17', 'm18', 'm20', 'm29', 'm34']) {
    const src = readFileSync(`src/modules/${m}/routes.ts`, 'utf8');
    const line = src.split('\n').find((l) => l.includes(`path: '${path}'`));
    const imp = line?.match(/import\('\.\/(\w+)'\)/);
    if (imp) return `${m}/${imp[1]}.tsx`;
  }
  return '';
}

describe('FS wave D · route registry', () => {
  it('288 routes after wave D (315 after wave E, 338 after wave F, 367 after wave G, 380 after wave H, 401 after wave I), and the 29 wave-D routes are registered', async () => {
    const { loadRoutes } = await import('../smoke/routes');
    const R = loadRoutes();
    expect(R.length).toBe(406); // Orientation 2026-10-17: + 2 (future-skills, start). Help centre 2026-10-17: + 3 (help, help-glossary, help-guide). FS wave I QA: + 21 (FS78/FS79 M34 5: my-learning-balance, team-study-time, workforce-learning-balances, my-external-certs, external-certs-queue; FS80 M29 4: workforce-ai-automations, workforce-ai-automation, my-ai-builds, admin-ai-automations; FS81 M30 4: my-transition-plan, workforce-transition-plans, workforce-transition-plan, workforce-rung-alerts; FS82/FS83 M36 6: my-grants, ecosystem-grants, workforce-grants, ecosystem-consortium, ecosystem-consortium-cohort, my-consortium; FS84 M17 2: team-skills-future, workforce-skills-inventory). FS wave H QA: + 13 (FS70-FS72 M28 7: skills-rising, skills-rising-method, workforce-skill-signals, my-manager-pulse, skills-technologies, admin-skills-technologies, my-skills-suggestions; FS73/FS74 M37 3: national-emirati-pipeline, my-future-wallet, national-future-wallet; FS77 M06 3: pathways-starter, my-induction, workforce-intake-baselines; FS75 shell digest and FS76 M13 none). FS wave G QA: + 29 (FS60/FS61 M35 6: workforce-disclosure, -metrics, -pack, workforce-pilots, workforce-pilot, skills-pilots; FS62/FS63 M37 5: national-alignment, -tag, national-report, national-occupations, admin-national-tags; FS64/FS65 M36 6: ecosystem-regional-plan, -commitments, -commitment, -demand-release, ecosystem-pledges, -register; FS66/FS67 M10 7: partner-university-programmes, training-university-programmes, university-programme, workforce-graduate-hires, universities-fellowships, university-fellowship, workforce-fellowships; FS68/FS69 M09 5: partner-future-readiness, admin-supplier-future-readiness, partner-prearrival, training-equivalency-prearrival, -share). FS wave F QA: + 23 (FS50/FS51 M35 7, FS54/FS55 M16 6, FS56/FS57 M25 3, FS58/FS59 M33 7; FS52/FS53 M07 none). FS wave E QA: + 27 wave-E routes (tests/unit/fsqa5-integration.test.tsx)
    const paths = new Set(R.map((r) => r.path));
    expect(WAVE_D.length).toBe(29);
    for (const [p] of WAVE_D) expect(paths.has(p), p).toBe(true);
  });
});

describe('FS wave D · benchmark chips', () => {
  it('every wave-D page names its card\'s chips, and every chip is a published registry row with an https source and an as-of date', () => {
    for (const [path, file0, feats] of WAVE_D) {
      const file = file0 || componentOf(path);
      expect(file, path).not.toBe('');
      const src = readFileSync(`src/modules/${file}`, 'utf8');
      const m34 = file.startsWith('m34/') && /<Bench \/>/.test(src); // m34/ui.tsx Bench = FS29 + FS30 chips
      for (const fs of feats) expect(m34 || new RegExp(`feature=(\\{['"]?${fs}['"]?\\}|"${fs}")`).test(src), `${path} ${file} ${fs}`).toBe(true);
    }
    expect(readFileSync('src/modules/m34/ui.tsx', 'utf8')).toContain('<BenchmarkChips feature="FS29" /><BenchmarkChips feature="FS30" />');
    const bench = new Map(T.benchmarks.map((b) => [b.id, b]));
    for (const fs of ['FS27', 'FS28', 'FS29', 'FS30', 'FS31', 'FS32', 'FS33', 'FS34', 'FS35', 'FS36', 'FS37']) {
      expect(FEATURE_BENCHMARKS[fs]?.length, fs).toBeGreaterThan(0);
      for (const id of FEATURE_BENCHMARKS[fs]) {
        const b = bench.get(id);
        expect(b, `${fs} ${id}`).toBeTruthy();
        expect((b.urls as string[]).every((u) => u.startsWith('https://')) && !!b.as_of, id).toBe(true);
      }
    }
  });
});

describe('FS wave D · FS31 -> FS27 strategic-credential gate', () => {
  let b: LocalBackend;
  beforeEach(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); });
  it('a gig that names a strategic credential refuses a non-holder (credential_required) and accepts a holder; an ungated gig is unchanged', async () => {
    b.setPersona('nse'); await b.whenReady();
    const no = await b.rpc.applyOpportunity('fg-ai-chem-trend-flags', '');
    expect(no.ok).toBe(false);
    expect(no.code).toBe('credential_required');
    expect((await b.rpc.applyOpportunity('fg-data-dose-history', '')).ok).toBe(true);
    b.setPersona('k-ro'); await b.whenReady();
    const yes = await b.rpc.applyOpportunity('fg-ai-chem-trend-flags', 'I hold MC-AI-ASSURER');
    expect(yes.ok).toBe(true);
    expect((await b.rpc.applyOpportunity('fg-dig-twin-validation', '')).code).toBe('credential_required');
    const chk = await b.rpc.credentialTargetCheck('opportunity', 'fg-ai-chem-trend-flags');
    expect(chk).toMatchObject({ named: true, unlocked: true, held: ['MC-AI-ASSURER'] });
  });
  it('TS targetCheck agrees with the seeded holders for every person and wave-D target', () => {
    const w = { today: TODAY, defs: T.microcred_defs, awards: T.microcred_awards, unlocks: T.microcred_unlocks, opportunities: T.opportunities, rotation_templates: T.rotation_templates } as never;
    for (const [code, kind0, target] of FSQA4_UNLOCKS) { const kind = kind0 as 'opportunity' | 'rotation';
      const holders = new Set(T.microcred_awards.filter((a) => a.def_code === code && a.status === 'awarded' && (!a.valid_to || a.valid_to >= TODAY)).map((a) => a.person_id));
      expect(holders.size, code).toBeGreaterThan(0);
      for (const pid of [...holders].slice(0, 5)) expect(targetCheck(pid, kind, target, w).unlocked, `${pid} ${target}`).toBe(true);
      expect(targetCheck('p-buyer', kind, target, w)).toMatchObject({ named: true, unlocked: false });
    }
  });
  it('the apply card shows the gate: unlocked with the held credential for a holder; locked, with no apply button, for a non-holder', async () => {
    const el = <Routes><Route path="/opportunities/:id" element={<OpportunityPage />} /></Routes>;
    await renderPage(el, { persona: 'k-ro', path: '/opportunities/fg-ai-chem-trend-flags' });
    const on = await screen.findByTestId('m20-strategic-gate', {}, W);
    expect(on.getAttribute('data-unlocked')).toBe('yes');
    expect(screen.getByTestId('m20-strategic-code').getAttribute('href')).toContain('/my/skills/credentials/c/MC-AI-ASSURER');
    expect(screen.getByTestId('m20-apply')).toBeTruthy();
    cleanup();
    await renderPage(el, { persona: 'nse', path: '/opportunities/fg-ai-chem-trend-flags' });
    const off = await screen.findByTestId('m20-strategic-gate', {}, W);
    expect(off.getAttribute('data-unlocked')).toBe('no');
    expect(screen.queryByTestId('m20-apply')).toBeNull();
  }, 120000);
});

describe('FS wave D · FS31 -> FS27/FS28 unlocks and FS31 -> FS30 credits', () => {
  it('the strategic tier names FS27 channel gigs and FS28 future-role rotations', () => {
    const ids = new Set(FSQA4_UNLOCKS.map(([c, k, t]) => `mcu:${c}:${k}:${t}`));
    const rows = T.microcred_unlocks.filter((u) => ids.has(u.id));
    expect(rows.length).toBe(4);
    expect(rows.every((u) => u.active && T.microcred_defs.some((d) => d.code === u.def_code && d.status === 'current' && d.strategic))).toBe(true);
    expect(rows.filter((u) => u.target_kind === 'opportunity').every((u) => T.opportunities.find((o) => o.id === u.target_id)?.channel)).toBe(true);
    expect(rows.filter((u) => u.target_kind === 'rotation').every((u) => T.rotation_templates.find((r) => r.id === u.target_id)?.future_track)).toBe(true);
  });
  it('every current micro-credential (FS31 included) has an indicative NQF level and credit tag; FS31 awards count in the ledger (creditsFor)', () => {
    for (const d of T.microcred_defs.filter((x) => x.status === 'current'))
      expect(T.credit_tags.some((t) => t.item_kind === 'microcred' && t.item_id === d.id && t.status === 'published' && t.indicative === true && t.nqf_level >= 1 && t.credits > 0), d.id).toBe(true);
    const fs31 = new Set(T.microcred_defs.filter((d) => FS31_CODES.includes(d.code)).map((d) => d.id));
    const holders = [...new Set(T.microcred_awards.filter((a) => fs31.has(a.def_id) && a.status === 'awarded').map((a) => a.person_id))].sort();
    expect(holders.length).toBeGreaterThan(10);
    const w = { credit_tags: T.credit_tags, training_records: T.training_records, pathway_enrolments: T.pathway_enrolments, microcred_awards: T.microcred_awards, rpl_requests: T.rpl_requests, credit_stacks: T.credit_stacks } as never;
    let fsRows = 0;
    for (const pid of holders) {
      const want = creditsFor(pid, w).map((r) => r.id).sort();
      expect(T.credit_ledger.filter((r) => r.person_id === pid && r.status === 'counted').map((r) => r.id).sort(), pid).toEqual(want);
      fsRows += want.filter((id) => [...fs31].some((d) => id.endsWith(`:microcred:${d}`))).length;
    }
    expect(fsRows).toBe(T.microcred_awards.filter((a) => fs31.has(a.def_id) && a.status === 'awarded').length);
  });
});

describe('FS wave D · FS27 -> FS17 gap backlog', () => {
  it('the backlog keeps 215 rows: open rows are exactly the requested steps; practice steps the channel gigs fill stay as filled', async () => {
    const content: Content = { courses: T.courses as never, externals: T.external_resources as never, opportunities: T.opportunities as never, credentials: T.microcred_defs as never, fitness: T.fitness_areas as never, adaptive: T.adaptive_banks as never, tasks: T.performance_tasks as never };
    const req = T.pathways.filter((p) => p.status === 'published').flatMap((p) => resolvePathway(p as never, T.pathway_steps as never, content).steps.filter((s) => s.status === 'requested').map((s) => `pg:${s.step_id}`)).sort();
    expect(T.pathway_gaps.filter((g) => g.status === 'open').map((g) => g.id).sort()).toEqual(req);
    expect(T.pathway_gaps.length).toBe(215);
    const viaGig = T.pathway_gaps.filter((g) => g.status === 'filled' && g.kind === 'practice');
    expect(viaGig.length).toBeGreaterThan(0);
    const noGigs = { ...content, opportunities: T.opportunities.filter((o) => !o.channel) as never };
    for (const g of viaGig) {
      const p = T.pathways.find((x) => x.id === g.pathway_id)!;
      expect(resolvePathway(p as never, T.pathway_steps as never, noGigs).steps.find((s) => s.step_id === g.step_id)!.status, g.id).toBe('requested');
    }
    const b = new LocalBackend(); await b.whenReady(); await b.reset();
    b.setPersona('training-mgr'); await b.whenReady();
    expect((await b.rpc.refreshPathwayGaps()).data).toMatchObject({ open: req.length, added: 0 });
  });
});

describe('FS wave D · FS07 -> FS33', () => {
  it('a goal set on a skill page links to "Skills I want to grow" to add a target date', async () => {
    await renderPage(<Routes><Route path="/skills/:id" element={<SkillPage />} /></Routes>, { persona: 'k-ro', path: '/skills/sk-fs-ai-verify' });
    const a = await screen.findByTestId('m28-goal-plan', {}, W);
    expect(a.getAttribute('href')).toContain('/my/skills/goals');
  }, 90000);
});

describe('FS wave D · migration', () => {
  it('is additive: one create-or-replace (kafaa_apply_opportunity), inserts on conflict do nothing into three kafaa_* tables, guarded kafaa_pathway_gaps updates only', () => {
    const sql = readFileSync('supabase/migrations/20261010249001_kafaa_fs4qa_integration.sql', 'utf8').replace(/--.*$/gm, '').replace(/\$j\$[\s\S]*?\$j\$/g, "''");
    expect(/\b(drop|delete|truncate|alter)\b/i.test(sql)).toBe(false);
    expect([...sql.matchAll(/create or replace function (\w+)/g)].map((m) => m[1])).toEqual(['kafaa_apply_opportunity']);
    const data = sql.slice(sql.indexOf("select set_config('kafaa.seeding'"));
    expect([...data.matchAll(/\binsert into (\w+)/g)].map((m) => m[1])).toEqual(['kafaa_microcred_unlocks', 'kafaa_credit_tags', 'kafaa_credit_ledger']);
    expect((data.match(/on conflict \(id\) do nothing/g) ?? []).length).toBe(3);
    expect([...data.matchAll(/\bupdate (\w+) set/g)].map((m) => m[1])).toEqual(['kafaa_pathway_gaps']);
    expect(data).toContain("where status = 'open' and last_checked = date '2026-10-11'");
    expect(sql).toContain("'credential_required', 'This gig is open to holders of a strategic credential it names'");
  });
});
