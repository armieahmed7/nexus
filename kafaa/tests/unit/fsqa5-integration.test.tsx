// @vitest-environment jsdom
/** [FS QA · wave E integration] Cross-feature wiring of FS38-FS49 on the integration branch, one test per integration criterion:
 *   routes        315 routes (288 after wave D + 27 wave-E routes), each wave-E path registered
 *   benchmarks    every wave-E page names its card's FS01 benchmark chips; every chip is a published row with an https source and an as-of date
 *   3.9 union     plant_visits, twin_attempts, lectures and knowledge_assets are recorded evidence: an F01 recompute keeps them (TS); the
 *                 QA migration holds the one final kafaa_skill_states_v2 / kafaa_skills_apply with the union of the lists (SQL)
 *   passport      the skills passport labels plant-visit, twin-drill and expert-contribution evidence
 *   FS38-FS13/14  Future Me and the ADVANCE pages link to the SMR delta (/my/next-gen for staff, /careers/next-gen for the public);
 *                 the HZ-4 / HZ-8 lanes too
 *   FS40-FS31/27  MC-TWINS lists published twin drills as a route (satisfiability); gig fg-dig-twin-validation shows them
 *   FS41-FS14/31  HZ-5 links CleanEnergyComp; MC-CLEAN-ENERGY cites its competences (cecCitations = kafaa_cec_cites); cecLevel exported for FS74
 *   FS42/43-17/30 the new pathways pass pathwayProblems, carry credit tags; MC-H2-HEAT stays a draft and satisfiable; the credit ledger is unchanged
 *   FS17 backlog  wave-E content fills no backlog step: 215 rows, open = requested steps, a refresh adds nothing
 *   FS45-F22      the handover board shows the overdue localisation items (loc-loit-watch, loc-rp-initial); instructors link the countdown
 *   FS48-F13      no M04 circle type is needed: mentor circles are M22 rows, the M04 mentoring tables are unchanged
 *   FS49-FS37     every HU card links existing drills or lessons; the local backend now enforces the FS49 content rule on direct writes
 *                 (mirror of the SQL trigger); /speak-up keeps noTelemetry
 *   FS39-F36      hosts see pending plant-visit confirmations under "approvals I owe"; confirming removes the item
 *   migration     the QA migration is additive (replaced functions with the same signatures, one internal helper, ALTER POLICY on wave-E
 *                 kafaa_* tables only, guarded updates) */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { renderPage } from './g1-harness';
import seed from '../../src/seed/seed.json';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { applySkills } from '../../src/data/local/rpc.w0';
import { localDigestData } from '../../src/shell/digest/backend/local';
import { gatherDigest } from '../../src/shell/digest/rules';
import { RECORDED_REF_TABLES, isRecordedEvidence } from '../../src/domain/skills';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { SCHEMA } from '../../src/data/schema';
import { I18nProvider } from '../../src/i18n';
import { resolvePathway, type Content } from '../../src/modules/m19/pathways';
import { routesFor, satisfiability } from '../../src/modules/m17/futureCreds';
import { useEvidenceLabel } from '../../src/modules/m17/PassportView';
import { cecCitations, cecLevel } from '../../src/modules/m32/cec';
import { twinDrillsFor } from '../../src/modules/m31/twin';
import { NextGenLink } from '../../src/modules/m31/links';
import { WAVE_E_LANE_LINKS } from '../../src/modules/m21/LanesSection';
import { routes as m08routes } from '../../src/modules/m08/routes';
import FuturePage from '../../src/modules/m11/FuturePage';
import MyFuturePage from '../../src/modules/m21/MyFuturePage';
import CredentialPage from '../../src/modules/m17/CredentialPage';
import OpportunityPage from '../../src/modules/m20/OpportunityPage';
import HandoverPage from '../../src/modules/m07/HandoverPage';
// @ts-expect-error untyped seed builder (.mjs)
import { WAVE_E_PATHWAYS as P0, WAVE_E_COURSES as C0, WAVE_E_REF_TABLES as R0 } from '../../scripts/seed/ext/fsqa5-integration.mjs';
const WAVE_E_PATHWAYS = P0 as string[];
const WAVE_E_COURSES = C0 as string[];
const WAVE_E_REF_TABLES = R0 as string[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = ((seed as any).tables ?? seed) as Record<string, Row[]>;
const W = { timeout: 60000 };
const MAIN_SEED_LEDGER = 426; // credit ledger rows after wave D (fsqa4)
const WAVE_E: [string, string, string[]][] = [
  ['/careers/next-gen', 'm31/CareersNextGenPage.tsx', ['FS38']], ['/my/next-gen', 'm31/MyNextGenPage.tsx', ['FS38']], ['/workforce/next-gen', 'm31/WorkforceNextGenPage.tsx', ['FS38']],
  ['/admin/next-gen', 'm31/AdminNextGenPage.tsx', ['FS38']], ['/learn/plant-literacy', 'm31/PlantLiteracyPage.tsx', ['FS39']], ['/my/plant-log', 'm31/PlantLogPage.tsx', ['FS39']],
  ['/my/twin-drills', 'm31/TwinDrillsPage.tsx', ['FS40']], ['/my/twin-drills/:id', 'm31/TwinDrillPage.tsx', ['FS40']], ['/training/twin-drills', 'm31/TrainingTwinDrillsPage.tsx', ['FS40']],
  ['/skills/clean-energy', 'm32/CleanEnergyPage.tsx', ['FS41']], ['/skills/clean-energy/:id', 'm32/CecCompetencePage.tsx', ['FS41']], ['/my/clean-energy', 'm32/MyCleanEnergyPage.tsx', ['FS41']],
  ['/workforce/clean-energy', 'm32/WorkforceCleanEnergyPage.tsx', ['FS41']], ['/learn/energy-transition', 'm32/EnergyTransitionPage.tsx', ['FS42', 'FS43']],
  ['/learn/energy-transition/esg-managers', 'm32/EsgManagersPage.tsx', ['FS43']], ['/learn/energy-transition/:chainId', 'm32/ValueChainPage.tsx', ['FS42']],
  ['/knowledge/lectures', 'm24/LecturesPage.tsx', ['FS44']], ['/knowledge/lectures/:lectureId', 'm24/LecturePage.tsx', ['FS44']], ['/knowledge/contributions', 'm24/ContributionsPage.tsx', ['FS44']],
  ['/knowledge/localisation', 'm24/LocalisationPage.tsx', ['FS45']],
  ['/leadership/behaviours', 'm22/LeadershipBehavioursPage.tsx', ['FS46']], ['/leadership/future-leaders', 'm22/FutureLeadersPage.tsx', ['FS47']],
  ['/leadership/future-leaders/manage', 'm22/FutureLeadersManagePage.tsx', ['FS47']], ['/communities/women-in-nuclear', 'm22/WomenInNuclearPage.tsx', ['FS48']],
  ['/communities/women-in-nuclear/programme', 'm22/WomenInNuclearProgrammePage.tsx', ['FS48']],
  ['/my/safety-culture/ai', 'm08/AiSafetyCulturePage.tsx', ['FS49']], ['/admin/hu-tools', 'm08/HuToolsAdminPage.tsx', ['FS49']],
];
const content = (): Content => ({ courses: T.courses as never, externals: T.external_resources as never, opportunities: T.opportunities as never, credentials: T.microcred_defs as never, fitness: T.fitness_areas as never, adaptive: T.adaptive_banks as never, tasks: T.performance_tasks as never });
const cw = () => ({ courses: T.courses, course_skill_links: T.course_skill_links, adaptive_banks: T.adaptive_banks, performance_tasks: T.performance_tasks, opportunities: T.opportunities, skills: T.skills, twin_scenarios: T.twin_scenarios });

describe('FS wave E · route registry', () => {
  it('315 routes after wave E (338 after wave F, 367 after wave G, 380 after wave H, 401 after wave I), and the 27 wave-E routes are registered', async () => {
    const { loadRoutes } = await import('../smoke/routes');
    const R = loadRoutes();
    expect(R.length).toBe(401); // FS wave I QA: + 21 (FS78/FS79 M34 5: my-learning-balance, team-study-time, workforce-learning-balances, my-external-certs, external-certs-queue; FS80 M29 4: workforce-ai-automations, workforce-ai-automation, my-ai-builds, admin-ai-automations; FS81 M30 4: my-transition-plan, workforce-transition-plans, workforce-transition-plan, workforce-rung-alerts; FS82/FS83 M36 6: my-grants, ecosystem-grants, workforce-grants, ecosystem-consortium, ecosystem-consortium-cohort, my-consortium; FS84 M17 2: team-skills-future, workforce-skills-inventory). FS wave H QA: + 13 (FS70-FS72 M28 7: skills-rising, skills-rising-method, workforce-skill-signals, my-manager-pulse, skills-technologies, admin-skills-technologies, my-skills-suggestions; FS73/FS74 M37 3: national-emirati-pipeline, my-future-wallet, national-future-wallet; FS77 M06 3: pathways-starter, my-induction, workforce-intake-baselines; FS75 shell digest and FS76 M13 none). FS wave G QA: + 29 (FS60/FS61 M35 6: workforce-disclosure, -metrics, -pack, workforce-pilots, workforce-pilot, skills-pilots; FS62/FS63 M37 5: national-alignment, -tag, national-report, national-occupations, admin-national-tags; FS64/FS65 M36 6: ecosystem-regional-plan, -commitments, -commitment, -demand-release, ecosystem-pledges, -register; FS66/FS67 M10 7: partner-university-programmes, training-university-programmes, university-programme, workforce-graduate-hires, universities-fellowships, university-fellowship, workforce-fellowships; FS68/FS69 M09 5: partner-future-readiness, admin-supplier-future-readiness, partner-prearrival, training-equivalency-prearrival, -share). FS wave F QA: + 23 (FS50/FS51 M35 7, FS54/FS55 M16 6, FS56/FS57 M25 3, FS58/FS59 M33 7; FS52/FS53 M07 none).
    const paths = new Set(R.map((r) => r.path));
    expect(WAVE_E.length).toBe(27);
    for (const [p] of WAVE_E) expect(paths.has(p), p).toBe(true);
  });
});

describe('FS wave E · benchmark chips', () => {
  it('every wave-E page names its card\'s chips, and every chip is a published registry row with an https source and an as-of date', () => {
    for (const [path, file, feats] of WAVE_E) {
      const src = readFileSync(`src/modules/${file}`, 'utf8');
      for (const fs of feats) expect(new RegExp(`feature=(\\{['"]?${fs}['"]?\\}|"${fs}")`).test(src), `${path} ${file} ${fs}`).toBe(true);
    }
    const bench = new Map(T.benchmarks.map((b) => [b.id, b]));
    for (const fs of ['FS38', 'FS39', 'FS40', 'FS41', 'FS42', 'FS43', 'FS44', 'FS45', 'FS46', 'FS47', 'FS48', 'FS49']) {
      expect(FEATURE_BENCHMARKS[fs]?.length, fs).toBeGreaterThan(0);
      for (const id of FEATURE_BENCHMARKS[fs]) {
        const b = bench.get(id);
        expect(b, `${fs} ${id}`).toBeTruthy();
        expect((b.urls as string[]).every((u) => u.startsWith('https://')) && !!b.as_of && b.listed, id).toBe(true);
      }
    }
  });
});

describe('FS wave E · recorded-evidence union (handover 3.9)', () => {
  it('plant visits, twin drills and expert contributions are recorded evidence that an F01 recompute keeps; the QA migration carries the union', async () => {
    expect(RECORDED_REF_TABLES).toEqual(expect.arrayContaining(WAVE_E_REF_TABLES));
    const b = new LocalBackend(); await b.whenReady(); await b.reset();
    const today = '2026-10-11';
    for (const t of ['plant_visits', 'twin_attempts', 'lectures']) {
      const row = (b.raw('skill_evidence') as Row[]).find((e) => e.ref_table === t && e.active);
      expect(row, t).toBeTruthy();
      expect(isRecordedEvidence(row as never), t).toBe(true);
      await applySkills(b, row.person_id, today);
      expect((b.rawGet('skill_evidence' as never, row.id) as unknown as Row).active, `${t} kept`).toBe(true);
    }
    const sql = readFileSync('supabase/migrations/20261010259001_kafaa_fs5qa_integration.sql', 'utf8');
    const lists = sql.match(/'fitness_attempts', 'adaptive_attempts', 'task_attempts', 'ai_drill_attempts'[^)]*\)/g) ?? [];
    expect(lists.length).toBe(2);
    for (const l of lists) for (const t of WAVE_E_REF_TABLES) expect(l, t).toContain(`'${t}'`);
    // the QA migration is the newest redefinition of both shared functions
    const files = ['20261010251001_kafaa_fs51_next_gen.sql', '20261010253001_kafaa_fs53_lectures_localisation.sql', '20261010259001_kafaa_fs5qa_integration.sql'];
    expect(files.filter((f) => readFileSync(`supabase/migrations/${f}`, 'utf8').includes('create or replace function kafaa_skills_apply')).pop()).toBe(files[2]);
  });
});

describe('FS wave E · skills passport labels', () => {
  it('labels plant-visit, twin-drill and expert-contribution evidence', () => {
    const out: Record<string, string> = {};
    const d = { courses: [], quals: [], standards: [], training: [], attempts: [], forms: [], badges: [], mcAwards: [] } as never;
    function Probe() {
      const label = useEvidenceLabel(d);
      out.pv = label({ kind: 'ojt', ref_table: 'plant_visits', ref_id: 'pv-1' }).title;
      out.tw = label({ kind: 'assessment', ref_table: 'twin_attempts', ref_id: 'ta-1' }).title;
      out.lc = label({ kind: 'rating', basis: 'validated', ref_table: 'lectures', ref_id: 'lec-1' }).title;
      out.ka = label({ kind: 'rating', basis: 'validated', ref_table: 'knowledge_assets', ref_id: 'ka-1' }).title;
      return null;
    }
    render(<MemoryRouter><I18nProvider><Probe /></I18nProvider></MemoryRouter>);
    expect(out).toEqual({ pv: 'Confirmed plant visit', tw: 'Digital-twin drill', lc: 'Validated expert contribution', ka: 'Validated expert contribution' });
  });
});

describe('FS wave E · FS38 -> FS13/FS14 and the ADVANCE pages', () => {
  it('the public ADVANCE page links the public SMR delta summary; Future Me links the personal delta; HZ-4 and HZ-8 lanes link it', async () => {
    await renderPage(<FuturePage />, { persona: null, path: '/future' });
    const pub = await screen.findByTestId('m31-next-gen-link', {}, W);
    expect(pub.getAttribute('data-to')).toBe('/careers/next-gen');
    expect(pub.textContent).toContain('no deployment decision implied');
    cleanup();
    await renderPage(<MyFuturePage />, { persona: 'nse', path: '/my/future' });
    const mine = await screen.findByTestId('m31-next-gen-link', {}, W);
    expect(mine.getAttribute('data-to')).toBe('/my/next-gen');
    expect(within(mine).getByRole('link').getAttribute('href')).toContain('/my/next-gen');
    expect(WAVE_E_LANE_LINKS['lane-advanced']).toContain('next_gen');
    expect(WAVE_E_LANE_LINKS['lane-manufacturing']).toContain('next_gen');
    expect(T.horizon_lanes.find((l) => l.id === 'lane-advanced')?.code).toBe('HZ-4');
  }, 120000);
  it('the link component picks the public summary for a partner user and the personal page for staff', async () => {
    await renderPage(<NextGenLink />, { persona: 'alnoor-qaqc', path: '/' });
    expect((await screen.findByTestId('m31-next-gen-link', {}, W)).getAttribute('data-to')).toBe('/careers/next-gen');
  }, 60000);
});

describe('FS wave E · FS40 -> FS31 / FS27', () => {
  it('MC-TWINS lists published twin drills as a route for its twin criterion; drafts never count', () => {
    const def = T.microcred_defs.find((d) => d.code === 'MC-TWINS' && d.status === 'current');
    const crit = def.criteria.find((c: Row) => c.kind === 'skill');
    const twins = routesFor(crit, cw() as never).filter((r) => r.kind === 'twin');
    expect(twins.length).toBeGreaterThan(0);
    expect(twins.every((r) => T.twin_scenarios.find((s) => s.id === r.id)?.status === 'published' && (r.level ?? 0) <= 2)).toBe(true);
    expect(routesFor(crit, { ...cw(), twin_scenarios: [] } as never).some((r) => r.kind === 'twin')).toBe(false);
    expect(satisfiability(def, cw() as never).ok).toBe(true);
    const drafts = T.twin_scenarios.filter((s) => s.status !== 'published').map((s) => s.id);
    expect(twinDrillsFor(T.twin_scenarios as never, ['sk-fs-ai-anomaly']).some((s) => drafts.includes(s.id))).toBe(false);
  });
  it('the credential page shows the twin-drill route, and gig fg-dig-twin-validation lists the drills that evidence its skills', async () => {
    await renderPage(<Routes><Route path="/my/skills/credentials/c/:code" element={<CredentialPage />} /></Routes>, { persona: 'k-ro', path: '/my/skills/credentials/c/MC-TWINS' });
    expect((await screen.findAllByTestId('m17-fc-route-twin', {}, W)).length).toBeGreaterThan(0);
    cleanup();
    await renderPage(<Routes><Route path="/opportunities/:id" element={<OpportunityPage />} /></Routes>, { persona: 'nse', path: '/opportunities/fg-dig-twin-validation' });
    const box = await screen.findByTestId('m31-twin-routes', {}, W);
    const gig = T.opportunities.find((o) => o.id === 'fg-dig-twin-validation');
    const want = twinDrillsFor(T.twin_scenarios as never, [...gig.skills_needed, ...gig.skills_gained]).map((s) => `/my/twin-drills/${s.id}`);
    expect(within(box).getAllByTestId('m31-twin-route').map((a) => a.getAttribute('href')!.replace(/^.*(\/my\/twin-drills\/)/, '$1'))).toEqual(want);
  }, 150000);
});

describe('FS wave E · FS41 -> FS14 / FS31 / FS74', () => {
  it('HZ-5 links CleanEnergyComp; MC-CLEAN-ENERGY cites its competences on the credential page; cecLevel is exported for FS74', async () => {
    expect(T.horizon_lanes.find((l) => l.id === 'lane-netzero')?.code).toBe('HZ-5');
    expect(WAVE_E_LANE_LINKS['lane-netzero']).toEqual(['cec']);
    expect(WAVE_E_LANE_LINKS['lane-hydrogen']).toEqual(['transition']);
    const def = T.microcred_defs.find((d) => d.code === 'MC-CLEAN-ENERGY' && d.status === 'current');
    const cites = cecCitations(def.criteria, T.cec_competences as never);
    expect(cites.map((c) => c.id)).toEqual(['cec-2-2', 'cec-3-1']);
    expect(cites.find((c) => c.id === 'cec-2-2')!.keys).toEqual(['adaptive', 'ghg']);
    expect(typeof cecLevel).toBe('function');
    expect(readFileSync('supabase/migrations/20261010252001_kafaa_fs52_energy_transition.sql', 'utf8')).toContain('create or replace function kafaa_cec_level');
    await renderPage(<Routes><Route path="/my/skills/credentials/c/:code" element={<CredentialPage />} /></Routes>, { persona: 'nse', path: '/my/skills/credentials/c/MC-CLEAN-ENERGY' });
    const box = await screen.findByTestId('m32-cec-citations', {}, W);
    expect(within(box).getAllByTestId('m32-cec-cite').map((x) => x.getAttribute('data-keys'))).toEqual(['adaptive,ghg', 'ghg']);
  }, 120000);
});

describe('FS wave E · FS42/FS43 -> FS17 / FS30 / FS31', () => {
  it('the new pathways are published FS17 pathways with credit tags; MC-H2-HEAT stays a draft and satisfiable; the credit ledger is unchanged', () => {
    for (const id of WAVE_E_PATHWAYS) {
      const p = T.pathways.find((x) => x.id === id);
      expect(p?.status, id).toBe('published');
      expect(resolvePathway(p as never, T.pathway_steps as never, content()).steps.every((s) => s.status !== 'requested'), id).toBe(true);
    }
    for (const id of [...WAVE_E_PATHWAYS, ...WAVE_E_COURSES]) expect(T.credit_tags.some((t) => t.item_id === id && t.status === 'published' && t.indicative), id).toBe(true);
    const h2 = T.microcred_defs.filter((d) => d.code === 'MC-H2-HEAT');
    expect(h2.map((d) => d.status)).toEqual(['draft']);
    expect(satisfiability(h2[0], cw() as never).ok).toBe(true);
    expect(T.credit_ledger.length).toBe(MAIN_SEED_LEDGER);
    expect(T.credit_tags.some((t) => t.item_id === h2[0].id)).toBe(false);
  });
});

describe('FS wave E · FS17 gap backlog', () => {
  it('wave-E content fills no backlog step: 215 rows, open rows are exactly the requested steps, and a refresh adds nothing', async () => {
    const req = T.pathways.filter((p) => p.status === 'published').flatMap((p) => resolvePathway(p as never, T.pathway_steps as never, content()).steps.filter((s) => s.status === 'requested').map((s) => `pg:${s.step_id}`)).sort();
    expect(T.pathway_gaps.length).toBe(215);
    expect(T.pathway_gaps.filter((g) => g.status === 'open').map((g) => g.id).sort()).toEqual(req);
    expect(req.length).toBe(145);
    const b = new LocalBackend(); await b.whenReady(); await b.reset();
    b.setPersona('training-mgr'); await b.whenReady();
    expect((await b.rpc.refreshPathwayGaps()).data).toMatchObject({ open: 145, added: 0 });
  });
});

describe('FS wave E · FS45 -> F22', () => {
  it('the handover board shows the overdue localisation items for HR, and the instructor pipeline links the countdown', async () => {
    await renderPage(<HandoverPage />, { persona: 'chco', path: '/workforce/handover' });
    const panel = await screen.findByTestId('m24-lz-handover-panel', {}, W);
    expect(within(panel).getAllByTestId('m24-lz-handover-item').map((x) => x.getAttribute('data-id')).sort()).toEqual(['loc-loit-watch', 'loc-rp-initial']);
    expect(readFileSync('src/modules/m02/InstructorsPage.tsx', 'utf8')).toContain('<L to="/knowledge/localisation">');
  }, 120000);
});

describe('FS wave E · FS48 -> F13', () => {
  it('no M04 circle type is needed: mentor circles are M22 rows and the M04 mentoring tables gained no column', () => {
    expect(SCHEMA.wfn_circles).toBeTruthy();
    expect(SCHEMA.wfn_circle_members).toBeTruthy();
    for (const t of ['mentoring_agreements', 'mentoring_sessions', 'mentors', 'mentoring_requests'] as const) {
      const cols = Object.keys((SCHEMA as Row)[t].cols);
      expect(cols.some((c) => /circle/.test(c)), t).toBe(false);
    }
    expect(T.wfn_circles.length).toBeGreaterThan(0);
  });
});

describe('FS wave E · FS49 -> FS37', () => {
  let b: LocalBackend;
  beforeEach(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); });
  it('every HU card links drills or lessons that exist; the local backend refuses a direct write that breaks the FS49 rule (SQL trigger mirror)', async () => {
    const drills = new Set(T.ai_drills.map((d) => d.id)), lessons = new Set(T.oe_lessons.map((l) => l.id));
    for (const h of T.hu_tools) {
      expect((h.drill_ids ?? []).length + (h.lesson_ids ?? []).length, h.id).toBeGreaterThan(0);
      expect((h.drill_ids ?? []).every((x: string) => drills.has(x)) && (h.lesson_ids ?? []).every((x: string) => lessons.has(x)), h.id).toBe(true);
    }
    b.setPersona('training-mgr'); await b.whenReady();
    const bad = await b.update('hu_tools', 'hu-ai-bias', { drill_ids: ['ad-nope'], lesson_ids: [] } as never);
    expect(bad.ok).toBe(false);
    expect(bad.message).toMatch(/^kafaa_fs49: drill_unknown/);
    const noLink = await b.update('hu_tools', 'hu-1', { drill_ids: [], lesson_ids: [] } as never);
    expect(noLink.message).toMatch(/^kafaa_fs49: links/);
    const okUpd = await b.update('hu_tools', 'hu-1', { ai_en: 'Treat a tool output as a colleague\'s claim: check it against the controlled source.' } as never);
    expect(okUpd.ok).toBe(true);
    const lesson = await b.insert('oe_lessons', { id: 'oe-ai-test', topic: 'ai_automation', title_en: 'x', title_ar: 'س', summary_en: 'x', summary_ar: 'س', lesson_en: 'x', lesson_ar: 'س', sources: [{ label: 'IAEA', url: 'http://example.org', year: 2025, as_of: '2026-10-10' }], status: 'draft' } as never);
    expect(lesson.ok).toBe(false);
    expect(lesson.message).toMatch(/source_url/);
    const speak = m08routes.find((r) => r.path === '/speak-up');
    expect((speak?.guard as Row)?.noTelemetry).toBe(true);
  });
});

describe('FS wave E · FS39 -> F36', () => {
  it('a host sees a pending plant-visit confirmation under approvals; confirming it removes the item', async () => {
    const b = new LocalBackend(); await b.whenReady(); await b.reset();
    const v = T.plant_visits.find((x) => x.id === 'pv-demo-09');
    expect(v.status).toBe('logged');
    const items = gatherDigest(localDigestData(b), v.host_person_id, '2026-10-11');
    const it0 = items.find((i) => i.id === 'approval:plant_visits:pv-demo-09');
    expect(it0).toMatchObject({ kind: 'approval', link: '/my/plant-log?tab=host', ref_table: 'plant_visits' });
    expect(it0!.why[0].code).toBe('approval_plant_visit');
    const seeded = T.digest_runs.find((r) => r.id === 'dg:p-training-mgr:2026-W41');
    expect(seeded.items.some((i: Row) => i.ref_table === 'plant_visits')).toBe(true);
    b.setPersona('training-mgr'); await b.whenReady();
    const r = await b.rpc.confirmVisit({ visit_id: 'pv-demo-09', decision: 'confirm' });
    expect(r.ok).toBe(true);
    expect(gatherDigest(localDigestData(b), v.host_person_id, '2026-10-11').some((i) => i.id === 'approval:plant_visits:pv-demo-09')).toBe(false);
  });
});

describe('FS wave E · migration', () => {
  it('is additive: three functions replaced with the same signatures, one internal helper, ALTER POLICY on wave-E kafaa_* tables, guarded updates', () => {
    const raw = readFileSync('supabase/migrations/20261010259001_kafaa_fs5qa_integration.sql', 'utf8');
    expect(/\b(drop|delete|truncate)\b/i.test(raw)).toBe(false);
    const sql = raw.replace(/--.*$/gm, '').replace(/\$j\$[\s\S]*?\$j\$/g, "''");
    expect([...sql.matchAll(/create or replace function (\w+)/g)].map((m) => m[1])).toEqual(['kafaa_skill_states_v2', 'kafaa_skills_apply', 'kafaa_dg_gather', 'kafaa_cec_cites']);
    const alters = [...sql.matchAll(/\balter (\w+) (\w+) on public\.(\w+)/g)];
    expect(alters.every((m) => m[1] === 'policy' && m[3].startsWith('kafaa_'))).toBe(true);
    expect(alters.map((m) => m[3]).sort()).toEqual(['kafaa_contributions', 'kafaa_lectures', 'kafaa_localisation_items', 'kafaa_plant_visits', 'kafaa_smr_deltas', 'kafaa_twin_attempts', 'kafaa_twin_keys', 'kafaa_twin_scenarios']);
    expect((sql.match(/\balter\b/g) ?? []).length).toBe(alters.length);
    const data = sql.slice(sql.indexOf("select set_config('kafaa.seeding'"));
    expect([...data.matchAll(/\bupdate (\w+) set/g)].map((m) => m[1])).toEqual(['kafaa_digest_runs', 'kafaa_digest_runs', 'kafaa_notifications', 'kafaa_notifications']);
    expect((data.match(/ where id = '[^']+' and /g) ?? []).length).toBe(4);
    expect(raw).toContain('revoke execute on function kafaa_cec_cites(jsonb) from public, anon, authenticated;');
  });
});
