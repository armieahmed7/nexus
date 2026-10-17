// @vitest-environment jsdom
/** [FS QA · wave C integration] Cross-feature wiring of FS17-FS26 on master, one test per integration criterion:
 *   routes      259 routes (227 after wave B + 32 wave-C routes), each wave-C path registered
 *   benchmarks  every wave-C page (and the Coach "Future skills" tab) names its card's FS01 benchmark chips; every chip is a published row
 *   FS21-FS17   assessment steps discover FS21 adaptive banks and FS22 performance tasks; a counting result ticks the step, a void does not
 *   FS19-FS17   the gap backlog keeps FS17's rows: open = requested steps, filled = steps FS19 courses and FS21/FS22 assessments now fill
 *   FS23-FS07   the skill page ladder shows FS23's behavioural indicators and links to the descriptor page
 *   FS17-FS23   a pathway page links to "what level N looks like" (FS23 descriptor page)
 *   FS19/17-25  a core-skill page lists the FS19 pack courses and (for staff) the FS17 pathways of its catalogue skills
 *   FS19/17-21  an adaptive result lists the courses and pathways for the bank's skills
 *   migration   the QA migration is additive (no DDL on tables, no delete) and names only kafaa_* objects */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderPage } from './g1-harness';
import seed from '../../src/seed/seed.json';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { FEATURE_BENCHMARKS } from '../../src/domain/taxonomy';
import { discover, pathwayProgress, recordsOf, resolvePathway, type Content } from '../../src/modules/m19/pathways';
import SkillPage from '../../src/modules/m28/SkillPage';
import PathwayPage from '../../src/modules/m19/PathwayPage';
import CoreSkillPage from '../../src/modules/m33/CoreSkillPage';
import AdaptiveTakePage from '../../src/modules/m05/AdaptiveTakePage';
import PerfTasksPage from '../../src/modules/m05/PerfTasksPage';
import { scopedPersonIds } from '../../src/data/scope';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T = ((seed as any).tables ?? seed) as Record<string, any[]>;
const W = { timeout: 60000 };
const content: Content = { courses: T.courses as never, externals: T.external_resources as never, opportunities: T.opportunities as never, credentials: T.microcred_defs as never, fitness: T.fitness_areas as never, adaptive: T.adaptive_banks as never, tasks: T.performance_tasks as never };
const rec = { training_records: T.training_records, external_completions: T.external_completions, opportunity_applications: T.opportunity_applications, microcred_awards: T.microcred_awards, fitness_attempts: T.fitness_attempts, adaptive_attempts: T.adaptive_attempts, task_attempts: T.task_attempts };
const WAVE_C = ['/learn/pathways', '/learn/pathways/:id', '/my/pathways', '/training/pathways', '/learn/external', '/training/external',
  '/learn/future-skills', '/learn/academies', '/learn/academies/:academyId', '/my/academies', '/training/future-skills', '/training/academies',
  '/my/assessments/adaptive', '/my/assessments/adaptive/:bank', '/my/assessments/tasks', '/my/assessments/tasks/:task', '/training/adaptive', '/training/perf-tasks', '/training/integrity',
  '/competencies/levels', '/competencies/descriptors', '/competencies/descriptors/:skillId', '/competencies/scale', '/my/levels', '/admin/descriptors', '/admin/authority',
  '/learn/core-skills', '/learn/core-skills/:id', '/my/core-skills', '/my/core-skills/practice', '/workforce/core-skills', '/training/sjt/items'];

describe('FS wave C · route registry', () => {
  it('259 routes after wave C (288 after wave D, 315 after wave E, 338 after wave F, 367 after wave G, 380 after wave H, 401 after wave I), and the 32 wave-C routes are registered', async () => {
    const { loadRoutes } = await import('../smoke/routes');
    const R = loadRoutes();
    expect(R.length).toBe(404); // Help centre 2026-10-17: + 3 (help, help-glossary, help-guide). FS wave I QA: + 21 (FS78/FS79 M34 5: my-learning-balance, team-study-time, workforce-learning-balances, my-external-certs, external-certs-queue; FS80 M29 4: workforce-ai-automations, workforce-ai-automation, my-ai-builds, admin-ai-automations; FS81 M30 4: my-transition-plan, workforce-transition-plans, workforce-transition-plan, workforce-rung-alerts; FS82/FS83 M36 6: my-grants, ecosystem-grants, workforce-grants, ecosystem-consortium, ecosystem-consortium-cohort, my-consortium; FS84 M17 2: team-skills-future, workforce-skills-inventory). FS wave H QA: + 13 (FS70-FS72 M28 7: skills-rising, skills-rising-method, workforce-skill-signals, my-manager-pulse, skills-technologies, admin-skills-technologies, my-skills-suggestions; FS73/FS74 M37 3: national-emirati-pipeline, my-future-wallet, national-future-wallet; FS77 M06 3: pathways-starter, my-induction, workforce-intake-baselines; FS75 shell digest and FS76 M13 none). FS wave G QA: + 29 (FS60/FS61 M35 6: workforce-disclosure, -metrics, -pack, workforce-pilots, workforce-pilot, skills-pilots; FS62/FS63 M37 5: national-alignment, -tag, national-report, national-occupations, admin-national-tags; FS64/FS65 M36 6: ecosystem-regional-plan, -commitments, -commitment, -demand-release, ecosystem-pledges, -register; FS66/FS67 M10 7: partner-university-programmes, training-university-programmes, university-programme, workforce-graduate-hires, universities-fellowships, university-fellowship, workforce-fellowships; FS68/FS69 M09 5: partner-future-readiness, admin-supplier-future-readiness, partner-prearrival, training-equivalency-prearrival, -share). FS wave F QA: + 23 (FS50/FS51 M35 7, FS54/FS55 M16 6, FS56/FS57 M25 3, FS58/FS59 M33 7; FS52/FS53 M07 none). FS wave E QA: + 27 wave-E routes (tests/unit/fsqa5-integration.test.tsx). FS wave D QA: + 29 wave-D routes (tests/unit/fsqa4-integration.test.tsx)
    const paths = new Set(R.map((r) => r.path));
    expect(WAVE_C.length).toBe(32);
    for (const p of WAVE_C) expect(paths.has(p), p).toBe(true);
  });
});

describe('FS wave C · benchmark chips', () => {
  it('every wave-C page names its card\'s chips, and every chip is a published registry row with an https source and an as-of date', () => {
    const src = (f: string) => readFileSync(`src/modules/${f}`, 'utf8');
    const pages: [string, string[]][] = [
      ['m19/PathwaysPage.tsx', ['FS17']], ['m19/PathwayPage.tsx', ['FS17']], ['m19/MyPathwaysPage.tsx', ['FS17']], ['m19/TrainingPathwaysPage.tsx', ['FS17']],
      ['m19/ExternalCataloguePage.tsx', ['FS18']], ['m19/TrainingExternalPage.tsx', ['FS18']], ['m19/FutureSkillsCoach.tsx', ['FS17', 'FS18']],
      ['m04/LearnFutureSkillsPage.tsx', ['FS19']], ['m04/TrainingFutureSkillsPage.tsx', ['FS19']], ['m04/FsCoursePanel.tsx', ['FS19']],
      ['m04/LearnAcademiesPage.tsx', ['FS20']], ['m04/LearnAcademyPage.tsx', ['FS20']], ['m04/MyAcademiesPage.tsx', ['FS20']], ['m04/TrainingAcademiesPage.tsx', ['FS20']],
      ['m05/AdaptivePage.tsx', ['FS21']], ['m05/AdaptiveTakePage.tsx', ['FS21']], ['m05/TrainingAdaptivePage.tsx', ['FS21']],
      ['m05/PerfTasksPage.tsx', ['FS22']], ['m05/PerfTaskPage.tsx', ['FS22']], ['m05/TrainingPerfTasksPage.tsx', ['FS22']], ['m05/IntegrityPage.tsx', ['FS22']],
      ['m02/LevelsPage.tsx', ['FS23']], ['m02/DescriptorLibraryPage.tsx', ['FS23']], ['m02/DescriptorPage.tsx', ['FS23']], ['m02/DescriptorsAdminPage.tsx', ['FS23']],
      ['m02/MyLevelsPage.tsx', ['FS23', 'FS24']], ['m02/ScaleMapPage.tsx', ['FS24']], ['m02/AuthorityAdminPage.tsx', ['FS24']],
      ['m33/CoreSkillsPage.tsx', ['FS25']], ['m33/CoreSkillPage.tsx', ['FS25']], ['m33/MyCoreSkillsPage.tsx', ['FS25']], ['m33/PracticePage.tsx', ['FS26']], ['m33/SjtItemsPage.tsx', ['FS26']],
    ];
    for (const [f, feats] of pages) for (const fs of feats) expect(new RegExp(`feature=(\\{${fs}\\}|"${fs}")`).test(src(f)), `${f} ${fs}`).toBe(true);
    // /workforce/core-skills lists the FS25 and FS26 ids explicitly (FS25_FS26 in m33/ui.tsx)
    expect(src('m33/WorkforceCoreSkillsPage.tsx')).toContain('BenchmarkChips ids={FS25_FS26}');
    for (const id of [...FEATURE_BENCHMARKS.FS25, ...FEATURE_BENCHMARKS.FS26]) expect(src('m33/ui.tsx').includes(`'${id}'`), id).toBe(true);
    const bench = new Map(T.benchmarks.map((b) => [b.id, b]));
    for (const fs of ['FS17', 'FS18', 'FS19', 'FS20', 'FS21', 'FS22', 'FS23', 'FS24', 'FS25', 'FS26']) {
      expect(FEATURE_BENCHMARKS[fs]?.length, fs).toBeGreaterThan(0);
      for (const id of FEATURE_BENCHMARKS[fs]) {
        const b = bench.get(id);
        expect(b, `${fs} ${id}`).toBeTruthy();
        expect((b.urls as string[]).every((u) => u.startsWith('https://')) && !!b.as_of, id).toBe(true);
      }
    }
  });
});

describe('FS wave C · FS21/FS22 -> FS17 pathways', () => {
  let b: LocalBackend;
  beforeEach(async () => { b = new LocalBackend(); await b.whenReady(); await b.reset(); });
  it('assessment steps discover active FS21 banks and FS22 tasks for the skill (never learn or practice steps), with links to take them', () => {
    const items = discover('assess', 'sk-fs-ai-verify', 2, content);
    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'adaptive', id: 'ab-ai-literacy', link: '/my/assessments/adaptive/ab-ai-literacy' }),
      expect.objectContaining({ type: 'task', id: 'pt-ai-alert', link: '/my/assessments/tasks/pt-ai-alert' }),
    ]));
    expect(discover('learn', 'sk-fs-ai-verify', 2, content).some((i) => i.type === 'adaptive' || i.type === 'task')).toBe(false);
    expect(discover('assess', 'sk-fs-ai-verify', 3, content).some((i) => i.type === 'task')).toBe(false); // tasks evidence level 2 at most
    const retired = { ...content, adaptive: (content.adaptive ?? []).map((x) => ({ ...x, status: 'retired' })) };
    expect(discover('assess', 'sk-fs-ai-verify', 2, retired).some((i) => i.type === 'adaptive')).toBe(false);
  });
  it('a completed FS21 attempt that counts ticks the step; a voided one or a failed task does not (LocalBackend shows the items)', async () => {
    const p = T.pathways.find((x) => x.id === 'pw-ai-verify-l2')!;
    const r = resolvePathway(p as never, T.pathway_steps as never, content);
    const assess = r.steps.find((s) => s.kind === 'assess')!;
    expect(assess.items.some((i) => i.type === 'adaptive' && i.id === 'ab-ai-literacy')).toBe(true);
    // k-ro also has a fitness check (listed first in the step) and, since FS31, the MC-AI-ASSURER credential; without both the adaptive result alone ticks the step
    const noFit = { ...rec, fitness_attempts: rec.fitness_attempts.filter((a) => a.person_id !== 'p-k-ro'), microcred_awards: rec.microcred_awards.filter((a) => a.person_id !== 'p-k-ro') };
    const done = pathwayProgress(r, recordsOf('p-k-ro', noFit));
    expect(done.steps.find((s) => s.step_id === assess.step_id)!.via).toBe('adaptive:ab-ai-literacy');
    const voided = { ...noFit, adaptive_attempts: rec.adaptive_attempts.map((a) => (a.person_id === 'p-k-ro' ? { ...a, counts: false } : a)) };
    expect(pathwayProgress(r, recordsOf('p-k-ro', voided)).steps.find((s) => s.step_id === assess.step_id)!.done).toBe(assess.items.some((i) => i.type === 'task' && i.id === 'pt-feedwater-drift'));
    expect(recordsOf('x', { ...rec, task_attempts: [{ person_id: 'x', task_id: 'pt-ai-alert', status: 'scored', passed: false, counts: true }] }).tasks).toEqual([]);
    b.setPersona('k-ro'); await b.whenReady();
    const det = await b.rpc.pathwayDetail('pw-ai-verify-l2');
    const step = det!.resolved.steps.find((s: { kind: string }) => s.kind === 'assess')!;
    // FS31 (wave D) added MC-AI-ASSURER, aligned to this skill at level 2: with the cap of 4 the step now shows the pinned and the
    // strategic credential, the fitness check and the FS21 bank; the FS22 task is still discovered for the step, just past the cap
    expect(step.items.map((i: { type: string }) => i.type)).toEqual(expect.arrayContaining(['credential', 'adaptive']));
    expect(discover('assess', p.skill_id, Number(p.level), content).some((i) => i.type === 'task')).toBe(true);
  });
  it('the gap backlog keeps FS17\'s rows: open rows are exactly the requested steps; FS19 courses and FS21/FS22 assessments filled the rest on the QA refresh', async () => {
    const pub = T.pathways.filter((p) => p.status === 'published');
    const req = pub.flatMap((p) => resolvePathway(p as never, T.pathway_steps as never, content).steps.filter((s) => s.status === 'requested').map((s) => `pg:${s.step_id}`)).sort();
    const open = T.pathway_gaps.filter((g) => g.status === 'open');
    const filled = T.pathway_gaps.filter((g) => g.status === 'filled');
    expect(open.map((g) => g.id).sort()).toEqual(req);
    expect(filled.length).toBeGreaterThan(0);
    expect(filled.every((g) => g.filled_on === '2026-10-11' && (g.kind === 'learn' || g.kind === 'assess' || g.kind === 'practice'))).toBe(true); // FS wave D QA: FS27 channel gigs filled practice steps on the same day (fsqa4)
    expect(T.pathway_gaps.length).toBe(215); // the rows FS17 loaded live; none removed
    b.setPersona('training-mgr'); await b.whenReady();
    const g = await b.rpc.refreshPathwayGaps();
    expect(g.data).toMatchObject({ open: open.length, added: 0 });
  });
});

describe('FS wave C · pages', () => {
  it('FS23 -> FS07: the skill page ladder shows the published behavioural indicators and links to the descriptor page', async () => {
    await renderPage(<Routes><Route path="/skills/:id" element={<SkillPage />} /></Routes>, { persona: null, path: '/skills/sk-fs-ai-verify' });
    const ladder = await screen.findByTestId('m28-ladder', {}, W);
    expect(ladder.querySelectorAll(':scope > li').length).toBe(4);
    expect((await within(ladder).findAllByTestId('m02-ci-indicators-sk-fs-ai-verify', {}, W)).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('m28-to-descriptors').getAttribute('href')).toContain('/competencies/descriptors/sk-fs-ai-verify');
  }, 90000);
  it('FS17 -> FS23: a pathway page links to "what this level looks like"', async () => {
    await renderPage(<Routes><Route path="/learn/pathways/:id" element={<PathwayPage />} /></Routes>, { persona: 'k-ro', path: '/learn/pathways/pw-ai-verify-l2' });
    const a = await screen.findByTestId('m19-pw-descriptor', {}, W);
    expect(a.getAttribute('href')).toContain('/competencies/descriptors/sk-fs-ai-verify');
    expect((await screen.findAllByTestId('m19-step-item', {}, W)).some((x) => x.getAttribute('data-type') === 'adaptive')).toBe(true);
  }, 90000);
  it('FS19/FS17 -> FS25: a core-skill page lists the pack courses and, for staff, the pathways of its catalogue skills (anon: courses only)', async () => {
    await renderPage(<CoreSkillPage />, { persona: 'k-ro', path: '/learn/core-skills/cs-systems', route: '/learn/core-skills/:id' });
    const courses = await screen.findByTestId('m33-cs-learn-courses', {}, W);
    expect(within(courses).getByText(/Systems thinking/)).toBeTruthy();
    expect(within(await screen.findByTestId('m33-cs-learn-pathways', {}, W)).getAllByRole('listitem').length).toBeGreaterThan(0);
  }, 90000);
  it('anon sees the core-skill pack courses but no pathways', async () => {
    await renderPage(<CoreSkillPage />, { persona: null, path: '/learn/core-skills/cs-systems', route: '/learn/core-skills/:id' });
    await screen.findByTestId('m33-cs-learn-courses', {}, W);
    expect(screen.queryByTestId('m33-cs-learn-pathways')).toBeNull();
  }, 90000);
  it('FS19/FS17 -> FS21: an adaptive result lists the courses and pathways for the bank\'s skills', async () => {
    await renderPage(<AdaptiveTakePage />, { path: '/my/assessments/adaptive/ab-ai-literacy', route: '/my/assessments/adaptive/:bank', persona: 'k-ro' });
    await screen.findByTestId('m05-take-result', {}, W);
    expect(within(await screen.findByTestId('m05-take-learn-courses', {}, W)).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(within(await screen.findByTestId('m05-take-learn-pathways', {}, W)).getAllByRole('listitem').length).toBeGreaterThan(0);
  }, 90000);
  it('FS22: someone with no task attempts still sees every active task, each "not started" (QA fix: an empty attempt list is not an empty page)', async () => {
    await renderPage(<PerfTasksPage />, { path: '/my/assessments/tasks', persona: 'nse' });
    const list = await screen.findByTestId('m05-pt-list', {}, W);
    expect(list.querySelectorAll('[data-testid^="m05-pt-card-"]').length).toBe(4);
    for (const id of ['pt-feedwater-drift', 'pt-twin-divergence', 'pt-ai-alert', 'pt-ghg-log']) expect(within(list).getByTestId(`m05-pt-open-${id}`)).toBeTruthy();
  }, 90000);
});

describe('FS wave C · scoped person reads (QA fix: manager person_skills read timed out live)', () => {
  it('a Scope-only manager narrows to their scope (a superset of what RLS returns); wide readers are not narrowed', async () => {
    const b = new LocalBackend();
    for (const persona of ['chem-sup', 'nse', 'chco', 'training-mgr', 'k-ecp']) {
      b.setPersona(persona); await b.whenReady();
      const who = b.identity();
      const people = await b.list('people', { filter: { kind: 'staff', status: 'active' } });
      const ids = scopedPersonIds(who, people as never, ['skills_profile', 'own_profile']);
      const all = await b.list('person_skills', { filter: { active: true } });
      const staff = new Set(people.map((p) => p.id));
      if (ids === null) continue;
      const narrowed = await b.list('person_skills', { filter: { active: true, person_id: ids } });
      expect(narrowed.map((r) => r.id).sort()).toEqual(all.filter((r) => staff.has(r.person_id as string)).map((r) => r.id).sort());
    }
    b.setPersona('chem-sup'); await b.whenReady();
    const ids = scopedPersonIds(b.identity(), (await b.list('people')) as never, ['skills_profile', 'own_profile'])!;
    expect(ids).not.toBeNull();
    expect(ids.length).toBeLessThan(20);
    for (const persona of ['training-mgr', 'presenter']) { // R on skills_profile: never narrowed
      b.setPersona(persona); await b.whenReady();
      expect(scopedPersonIds(b.identity(), [], ['skills_profile', 'own_profile'])).toBeNull();
    }
  }, 120000);
});

describe('FS wave C · QA migration', () => {
  it('is additive: create-or-replace of three kafaa_* functions and guarded updates of kafaa_pathway_gaps (and three kafaa_skills key orders) only', () => {
    const sql = readFileSync('supabase/migrations/20261010239001_kafaa_fs3qa_integration.sql', 'utf8').replace(/--.*$/gm, '');
    expect(/\b(drop|delete|truncate|alter|create table)\b/i.test(sql)).toBe(false);
    expect([...sql.matchAll(/create or replace function (\w+)/g)].map((m) => m[1])).toEqual(['kafaa_pw_item', 'kafaa_pw_discover', 'kafaa_pw_progress']);
    const upd = [...sql.matchAll(/\bupdate (\w+) set/g)].map((m) => m[1]);
    expect(upd).toEqual(['kafaa_pathway_gaps', 'kafaa_pathway_gaps', 'kafaa_skills', 'kafaa_skills', 'kafaa_skills']);
    expect(sql).toContain("last_checked = date '2026-10-10'");
  });
});
