// @vitest-environment jsdom
/** [FS QA · wave B integration] Cross-feature wiring of FS07-FS16 on master, one test per integration criterion:
 *   routes      227 routes (212 after wave A + 15 wave-B routes), each wave-B path registered
 *   benchmarks  every wave-B page names its card's FS01 benchmark chips; every chip id is a published registry row with https sources
 *   FS10-F35    FS02 future-skill states are not F35 supply; the stored outlooks and the stress-test summary are back to the released ones
 *   FS10-F23    a reserve member's skill snapshot never lists an FS02 skill (fitness-check evidence cannot push verified skills out)
 *   FS15-F36    a shortlisted concept role never becomes the digest's (or Dalil's) target role
 *   FS15-F12    a shared concept target reads its FS05-profile readiness in the career-conversation agenda, never 0 %
 *   FS16-M01    career role pages and cards show the role's outlook label, linked to the published criteria
 *   FS11-M01    a role's horizons tab links to its public transformation map; a concept role page links to the Navigator roadmap
 *   FS15-FS13   Future Me's closest roles show the FS15 profile readiness (one rule) and a roadmap link
 *   FS09-FS07   an AI skill's catalogue page links to the AI fluency ladder; wave-B pages link skills to /skills/:id
 *   migration   the QA migration is additive (no DDL on tables, no delete) and names only kafaa_* objects */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import seed from '../../src/seed/seed.json';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { defaultTargetRole } from '../../src/shell/digest/rules';
import { snapshotFrom } from '../../src/modules/m20/reserve';
import { gatherBase, inputFromTables } from '../../src/modules/m07/outlook';
import CareersRolePage from '../../src/modules/m01/CareersRolePage';
import CareersPage from '../../src/modules/m01/CareersPage';
import TeamCareerPage from '../../src/modules/m18/TeamCareerPage';
import MyCareerPage from '../../src/modules/m18/MyCareerPage';
import MyFuturePage from '../../src/modules/m21/MyFuturePage';
import SkillPage from '../../src/modules/m28/SkillPage';
import MyRole2030Page from '../../src/modules/m30/MyRole2030Page';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = ((seed as any).tables ?? seed) as Record<string, any[]>;
const W = { timeout: 60000 };
const CONCEPT = T.job_roles.filter((r) => r.lifecycle === 'concept').map((r) => r.id as string);
const FS_SKILLS = new Set(T.skills.filter((s) => s.fs_area).map((s) => s.id as string));

describe('FS wave B · route registry', () => {
  it('227 routes, and the 15 wave-B routes are registered', async () => {
    const { loadRoutes } = await import('../smoke/routes');
    const R = loadRoutes();
    expect(R.length).toBe(401); // FS wave I QA: + 21 (FS78/FS79 M34 5: my-learning-balance, team-study-time, workforce-learning-balances, my-external-certs, external-certs-queue; FS80 M29 4: workforce-ai-automations, workforce-ai-automation, my-ai-builds, admin-ai-automations; FS81 M30 4: my-transition-plan, workforce-transition-plans, workforce-transition-plan, workforce-rung-alerts; FS82/FS83 M36 6: my-grants, ecosystem-grants, workforce-grants, ecosystem-consortium, ecosystem-consortium-cohort, my-consortium; FS84 M17 2: team-skills-future, workforce-skills-inventory). FS wave H QA: + 13 (FS70-FS72 M28 7: skills-rising, skills-rising-method, workforce-skill-signals, my-manager-pulse, skills-technologies, admin-skills-technologies, my-skills-suggestions; FS73/FS74 M37 3: national-emirati-pipeline, my-future-wallet, national-future-wallet; FS77 M06 3: pathways-starter, my-induction, workforce-intake-baselines; FS75 shell digest and FS76 M13 none). FS wave G QA: + 29 (FS60/FS61 M35 6: workforce-disclosure, -metrics, -pack, workforce-pilots, workforce-pilot, skills-pilots; FS62/FS63 M37 5: national-alignment, -tag, national-report, national-occupations, admin-national-tags; FS64/FS65 M36 6: ecosystem-regional-plan, -commitments, -commitment, -demand-release, ecosystem-pledges, -register; FS66/FS67 M10 7: partner-university-programmes, training-university-programmes, university-programme, workforce-graduate-hires, universities-fellowships, university-fellowship, workforce-fellowships; FS68/FS69 M09 5: partner-future-readiness, admin-supplier-future-readiness, partner-prearrival, training-equivalency-prearrival, -share). FS wave F QA: + 23 (FS50/FS51 M35 7, FS54/FS55 M16 6, FS56/FS57 M25 3, FS58/FS59 M33 7; FS52/FS53 M07 none). FS wave E QA: + 27 (FS38-FS40 M31 9, FS41-FS43 M32 7, FS44/FS45 M24 4, FS46-FS48 M22 5, FS49 M08 2). FS wave D QA: + 29 (FS27/FS28 M20 6, FS29/FS30 M34 7, FS31-FS33 M17 7, FS34/FS35 M18 2, FS36/FS37 M29 7). FS wave C QA: + 32 wave-C routes (tests/unit/fsqa3-integration.test.tsx)
    const paths = new Set(R.map((r) => r.path));
    for (const p of ['/skills', '/skills/:id', '/skills/frameworks', '/admin/skills/alignments', '/learn/ai-fluency', '/my/ai-fluency', '/my/ai-fluency/check', '/workforce/ai-fluency',
      '/training/ai-fitness/items', '/my/role-2030', '/my/role-2030/tasks', '/careers/roles/:slug/transformation', '/workforce/transformation', '/workforce/transformation/:roleId',
      '/careers/outlook-criteria']) expect(paths.has(p), p).toBe(true);
  });
});

describe('FS wave B · benchmark chips', () => {
  it('every wave-B page names its card\'s chips, and every chip is a published registry row with an https source and an as-of date', () => {
    const src = (f: string) => readFileSync(`src/modules/${f}`, 'utf8');
    const pages: [string, string[]][] = [
      ['m28/SkillsExplorerPage.tsx', ['FS07']], ['m28/SkillPage.tsx', ['FS07', 'FS08']], ['m28/FrameworksPage.tsx', ['FS08']], ['m28/AlignmentsAdminPage.tsx', ['FS08']],
      ['m29/LadderPage.tsx', ['FS09']], ['m29/MyFluencyPage.tsx', ['FS09']], ['m29/FitnessCheckPage.tsx', ['FS10']], ['m29/ItemBankPage.tsx', ['FS10']],
      ['m30/MyRole2030Page.tsx', ['FS11']], ['m30/TaskExposurePage.tsx', ['FS12']], ['m30/CareersTransformationPage.tsx', ['FS11']], ['m30/WorkforceTransformationPage.tsx', ['FS11', 'FS12']],
      ['m30/TransformationEditPage.tsx', ['FS11']], ['m21/v2ui.tsx', ['FS13']], ['m21/LanesSection.tsx', ['FS14']], ['m21/FutureDemandPage.tsx', ['FS14']],
      ['m18/FutureRoles.tsx', ['FS15']], ['m18/MyRoadmapPage.tsx', ['FS15']], ['m18/TeamCareerPage.tsx', ['FS15']], ['m18/MyCareerPage.tsx', ['FS16']], ['m18/CareersOutlookCriteriaPage.tsx', ['FS16']],
    ];
    for (const [f, feats] of pages) for (const fs of feats) expect(new RegExp(`feature=(\\{${fs}\\}|"${fs}")`).test(src(f)), `${f} ${fs}`).toBe(true);
    // /workforce/ai-fluency lists the FS09 and FS10 ids explicitly
    const wf = src('m29/WorkforceFluencyPage.tsx');
    for (const id of [...FEATURE_BENCHMARKS.FS09, ...FEATURE_BENCHMARKS.FS10]) expect(wf.includes(`'${id}'`), id).toBe(true);
    const bench = new Map(T.benchmarks.map((b) => [b.id, b]));
    for (const fs of ['FS07', 'FS08', 'FS09', 'FS10', 'FS11', 'FS12', 'FS13', 'FS14', 'FS15', 'FS16']) {
      expect(FEATURE_BENCHMARKS[fs]?.length, fs).toBeGreaterThan(0);
      for (const id of FEATURE_BENCHMARKS[fs]) {
        const b = bench.get(id);
        expect(b, `${fs} ${id}`).toBeTruthy();
        expect((b.urls as string[]).every((u) => u.startsWith('https://')) && !!b.as_of, id).toBe(true);
      }
    }
  });
});

describe('FS wave B · FS10 -> F35 / F23', () => {
  it('F35 supply ignores FS02 future-skill states, so the stored outlooks are the released ones and the stress test reads "every family falls short"', () => {
    const inp = inputFromTables((t) => T[t] ?? []);
    const without = inputFromTables((t) => (t === 'person_skills' ? T.person_skills.filter((s) => !FS_SKILLS.has(s.skill_id)) : T[t] ?? []));
    expect(T.person_skills.filter((s) => FS_SKILLS.has(s.skill_id)).length).toBeGreaterThan(500);
    expect(JSON.stringify(gatherBase(inp, null))).toBe(JSON.stringify(gatherBase(without, null)));
    const stress = T.skill_outlooks.find((o) => o.id === 'so-attrition-stress');
    expect(stress.results.totals.families_short).toBe(stress.results.totals.visible);
    const digital = stress.results.families.find((f: { key: string }) => f.key === 'digital');
    expect(digital.s0).toBe(616);
  });

  it('a reserve member\'s skill snapshot never lists an FS02 skill, so fitness-check evidence never displaces verified skills', () => {
    for (const a of T.alumni) expect((a.skill_snapshot ?? []).some((x: { skill_id: string }) => FS_SKILLS.has(x.skill_id)), a.id).toBe(false);
    const pid = 'w-instr-01';
    const snap = snapshotFrom(T.person_skills.filter((s) => s.person_id === pid), T.skills);
    expect(T.person_skills.some((s) => s.person_id === pid && FS_SKILLS.has(s.skill_id) && s.level >= 2)).toBe(true);
    expect(snap.map((x) => x.skill_id)).toContain('sk-ld-01-coach');
    expect(snap.every((x) => !FS_SKILLS.has(x.skill_id))).toBe(true);
  });
});

describe('FS wave B · FS15 -> F36 / F12', () => {
  it('a concept role shortlisted first never becomes the digest or Dalil target role', () => {
    for (const p of T.people.filter((x) => x.kind === 'staff')) {
      const short = T.career_targets.filter((t) => t.person_id === p.id && t.active !== false).sort((a, b) => a.rank - b.rank).map((t) => t.role_id);
      expect(defaultTargetRole(T.career_paths, p.job_role_id ?? null, [CONCEPT[0], ...short])).toBe(defaultTargetRole(T.career_paths, p.job_role_id ?? null, short));
    }
    expect(defaultTargetRole(T.career_paths, 'reactor-operator', ['fr-bwr-operator'])).not.toBe('fr-bwr-operator');
  });

  it('a shared concept target reads its FS05-profile readiness in the career-conversation agenda (never 0 %)', async () => {
    const b = new LocalBackend();
    await b.whenReady();
    await b.reset();
    b.setPersona('k-ro');
    await b.whenReady();
    const mine = await b.list('career_targets', { filter: { person_id: 'p-k-ro', active: true } });
    expect((await b.update('career_targets', mine[2].id, { active: false })).ok).toBe(true);
    expect((await b.insert('career_targets', { id: 'ct:p-k-ro:fr-bwr-operator', person_id: 'p-k-ro', role_id: 'fr-bwr-operator', rank: 3, shared: true, active: true } as never)).ok).toBe(true);
    const ag = await b.rpc.conversationAgenda('p-k-ro');
    expect(ag.ok).toBe(true);
    const x = ag.data!.targets.find((t) => t.role_id === 'fr-bwr-operator')!;
    const fr = await b.rpc.futureRoleReadiness('p-k-ro', ['fr-bwr-operator']);
    expect(x.concept).toBe(true);
    expect(x.pct).toBe(fr.data![0].pct);
    expect(x.pct).toBeGreaterThan(0);
    expect(x.band).toBe(fr.data![0].band);
    expect(x.gate_status).toBe('none');
    // current targets keep the F05 readiness
    expect(ag.data!.targets.filter((t) => !t.concept).every((t) => ['ready_now', 'ready_in', 'stretch', 'path_only', 'current'].includes(t.band))).toBe(true);
  }, 60000);
});

describe('FS wave B · career pages (FS16, FS11, FS15, FS09)', () => {
  it('a role page shows its outlook label linked to the criteria, and its horizons tab links to the public transformation map', async () => {
    await renderPage(<CareersRolePage />, { path: '/careers/roles/reactor-operator?tab=horizons', route: '/careers/roles/:slug' });
    const line = await screen.findByTestId('m18-fs16-line', {}, W);
    expect(within(line).getByTestId('m18-fs16-label').getAttribute('data-label')).toMatch(/^(growing|changing|stable)$/);
    expect(within(line).getByTestId('m18-fs16-criteria-link').getAttribute('href')).toContain('/careers/outlook-criteria');
    expect((await screen.findByTestId('m01-to-transformation', {}, W)).getAttribute('href')).toContain('/careers/roles/reactor-operator/transformation');
  }, 60000);

  it('role cards on /careers carry the outlook label; concept and security roles carry none', async () => {
    await renderPage(<CareersPage />, { path: '/careers' });
    const list = await screen.findByTestId('m01-role-list', {}, W);
    await waitFor(() => expect(within(list).getAllByTestId('m18-fs16-label').length).toBe(T.role_outlook_labels.filter((l) => l.year === Math.max(...T.role_outlook_labels.map((y) => y.year))).length), W);
  }, 60000);

  it('a concept role page links to the Navigator roadmap', async () => {
    await renderPage(<CareersRolePage />, { path: '/careers/roles/fr-bwr-operator', route: '/careers/roles/:slug' });
    expect((await screen.findByTestId('m01-concept-roadmap', {}, W)).getAttribute('href')).toContain('/my/career/roadmap?role=fr-bwr-operator');
  }, 60000);

  it('the manager view shows the FS15 chips and /my/career shows the FS16 chips beside the labelled moves', async () => {
    await renderPage(<TeamCareerPage />, { path: '/team/career', persona: 'sro' });
    await waitFor(() => expect(screen.getByTestId('m18-bench-fs15').querySelectorAll('[data-testid^="benchmark-chip-"]').length).toBe(FEATURE_BENCHMARKS.FS15.length), W);
    await renderPage(<MyCareerPage />, { path: '/my/career', persona: 'k-ro' });
    await waitFor(() => expect(screen.getByTestId('m18-bench-fs16').querySelectorAll('[data-testid^="benchmark-chip-"]').length).toBe(FEATURE_BENCHMARKS.FS16.length), W);
  }, 90000);

  it('Future Me\'s closest roles show the FS15 profile readiness and link to the roadmap', async () => {
    await renderPage(<MyFuturePage />, { path: '/my/future', persona: 'k-ro' });
    const rows = await screen.findAllByTestId('m21-concept-readiness', {}, W);
    expect(rows.length).toBeGreaterThan(0);
    expect(within(rows[0]).getByTestId('m18-fs15-band')).toBeTruthy();
    expect(within(rows[0]).getByTestId('m21-to-roadmap').getAttribute('href')).toContain('/my/career/roadmap?role=fr-');
  }, 60000);

  it('an AI skill\'s catalogue page links to the AI fluency ladder; My Role in 2030 links its skills to /skills/:id and shows the outlook label', async () => {
    await renderPage(<SkillPage />, { path: '/skills/sk-fs-ai-verify', route: '/skills/:id', persona: 'k-ro' });
    const tr = await screen.findByTestId('m28-ai-track', {}, W);
    expect(tr.getAttribute('data-track')).toBe('literacy');
    expect(within(tr).getByTestId('m28-to-ai-ladder').getAttribute('href')).toContain('/learn/ai-fluency');
    await renderPage(<MyRole2030Page />, { path: '/my/role-2030', persona: 'k-ro' });
    await waitFor(() => expect(screen.getAllByTestId('m30-skill-link').length).toBeGreaterThan(0), W);
    expect(screen.getAllByTestId('m30-skill-link')[0].getAttribute('href')).toMatch(/\/skills\/sk-/);
    await screen.findByTestId('m18-fs16-line', {}, W);
  }, 90000);
});

describe('FS wave B · QA migration', () => {
  it('is additive: create-or-replace of four kafaa_* functions and guarded updates of kafaa_* rows only', () => {
    const sql = readFileSync('supabase/migrations/20261010229001_kafaa_fs2qa_integration.sql', 'utf8').replace(/--.*$/gm, '');
    expect(/\b(drop|delete|truncate|alter)\b/i.test(sql)).toBe(false);
    expect([...sql.matchAll(/create or replace function (\w+)/g)].map((m) => m[1])).toEqual(['kafaa_so_base', 'kafaa_dg_gather', 'kafaa_cc_agenda', 'kafaa_res_snapshot']);
    for (const m of sql.matchAll(/update (\w+)/g)) expect(m[1].startsWith('kafaa_'), m[1]).toBe(true);
    for (const m of sql.matchAll(/^update [^\n]*$/gm)) expect(m[0]).toMatch(/ where id = '[^']+' and /);
  });
});
