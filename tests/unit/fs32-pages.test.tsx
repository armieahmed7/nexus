// @vitest-environment jsdom
/** FS19/FS20 pages rendered with the real providers and the in-memory LocalBackend: the public course pack (EN and AR) with routes for
 *  the six unheld skills and the cross-over versions, my picks with "Why this?", the course panel on /learn/course/:id, the studio
 *  (coverage, copy and link check, link editor), the academies and one academy (template, modules, project, mentor role, suppressed
 *  statistics), my academies (capstone, reviews) and the programme owner's console. Every page shows its benchmark chips. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderPage } from './g1-harness';
import LearnFutureSkillsPage from '../../src/modules/m04/LearnFutureSkillsPage';
import TrainingFutureSkillsPage from '../../src/modules/m04/TrainingFutureSkillsPage';
import LearnAcademiesPage from '../../src/modules/m04/LearnAcademiesPage';
import LearnAcademyPage from '../../src/modules/m04/LearnAcademyPage';
import MyAcademiesPage from '../../src/modules/m04/MyAcademiesPage';
import TrainingAcademiesPage from '../../src/modules/m04/TrainingAcademiesPage';
import LearnCoursePage from '../../src/modules/m04/LearnCoursePage';

const T = { timeout: 20000 };

describe('FS19 pages', () => {
  it('the public pack: 18 courses, cross-over versions, routes for the 6 unheld skills, SIMULATED and the FS19 chips', async () => {
    await renderPage(<LearnFutureSkillsPage />, { persona: null, path: '/learn/future-skills' });
    expect((await screen.findAllByTestId('m04-fsc-course', {}, { timeout: 90000 })).length).toBe(18);
    expect(screen.getByTestId('m04-fsc-crossover').children.length).toBe(2);
    expect(screen.getByTestId('m04-fsc-routes').querySelectorAll('tbody tr').length).toBe(6);
    expect(screen.getAllByTestId('m04-no-decision').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m04-fsc-copycheck')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-SMR-WF').tagName).toBe('BUTTON'), T);
    expect(screen.getByTestId('benchmark-chip-UAE-PEERS')).toBeTruthy();
    expect(screen.getByTestId('benchmark-chip-ENTITLE')).toBeTruthy();
  }, 150000);
  it('the pack renders in Arabic', async () => {
    await renderPage(<LearnFutureSkillsPage />, { persona: null, path: '/ar/learn/future-skills' });
    expect((await screen.findAllByTestId('m04-fsc-course', {}, T)).length).toBe(18);
    expect(document.body.textContent).toContain('حزمة');
    expect(document.body.textContent).toContain('النظافة السيبرانية');
  }, 40000);
  it('picked for me (outage planner): courses that close 2030 gaps, ranked, with "Why this?" reasons and enrol', async () => {
    await renderPage(<LearnFutureSkillsPage />, { persona: 'outage-planner', path: '/learn/future-skills' });
    const list = await screen.findByTestId('m04-fsc-forme', {}, T);
    expect(list.querySelectorAll('li').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('m04-fsc-enrol').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('m04-fsc-why-0'));
    expect((await screen.findByTestId('m04-fsc-why-0-panel')).textContent).toMatch(/2030 profile needs level/);
  }, 40000);
  it('picked for me (k-ro, no linked gaps): an honest "no gaps" message instead of padding', async () => {
    await renderPage(<LearnFutureSkillsPage />, { persona: 'k-ro', path: '/learn/future-skills' });
    await waitFor(() => expect(document.body.textContent).toMatch(/No gaps the pack closes/), T);
    expect(screen.queryByTestId('m04-fsc-forme')).toBeNull();
  }, 40000);
  it('the course page shows the pack panel: skills at a level, envelope, copy check and sources with as-of', async () => {
    await renderPage(<LearnCoursePage />, { persona: null, path: '/learn/course/c-fs-cyber', route: '/learn/course/:id' });
    const panel = await screen.findByTestId('m04-fs-panel', {}, T);
    expect(panel.querySelectorAll('[data-testid="m04-fs-skill"]').length).toBe(5);
    expect(screen.getByTestId('m04-fs-panel-check').getAttribute('data-result')).toBe('passed');
    expect(panel.textContent).toMatch(/As of/);
  }, 40000);
  it('the studio: coverage by future skill, the copy check (run by the training manager) and the link editor', async () => {
    await renderPage(<TrainingFutureSkillsPage />, { persona: 'training-mgr', path: '/training/future-skills' });
    const cov = await screen.findByTestId('m04-fst-coverage', {}, T);
    expect(cov.querySelectorAll('[data-covered="yes"]').length).toBeGreaterThanOrEqual(30);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-SMR-WF')).toBeTruthy(), T);
    fireEvent.click(screen.getByRole('tab', { name: /Copy and link check/ }));
    expect((await screen.findAllByTestId('m04-fst-result', {}, T)).every((x) => x.getAttribute('data-result') === 'passed')).toBe(true);
    expect(screen.getByTestId('m04-fst-run')).toBeTruthy();
  }, 40000);
});

describe('FS20 pages', () => {
  it('the academies: template triad, four academies with modules, project and mentor role, calendar, suppressed small cohorts, FS20 chips', async () => {
    await renderPage(<LearnAcademiesPage />, { persona: null, path: '/learn/academies' });
    expect((await screen.findAllByTestId('m04-acad-card', {}, T)).length).toBe(4);
    expect(screen.getByTestId('m04-triad-mentor')).toBeTruthy();
    expect(screen.getByTestId('m04-acad-calendar').textContent).toMatch(/Cohort 1/);
    expect(screen.getAllByTestId('m04-suppressed').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-NUC-NET').tagName).toBe('BUTTON'), T);
  }, 40000);
  it('one academy: modules, project, mentor and reviewer roles, cohorts with suppressed statistics; staff can nominate', async () => {
    await renderPage(<LearnAcademyPage />, { persona: 'k-ro', path: '/learn/academies/ac-energy', route: '/learn/academies/:academyId' });
    expect((await screen.findByTestId('m04-acad-modules', {}, T)).querySelectorAll('li').length).toBe(3);
    expect(screen.getByTestId('m04-acad-project').textContent).toMatch(/carbon/);
    expect(screen.getAllByTestId('m04-acad-cohort').length).toBe(1);
    expect(screen.getAllByTestId('m04-suppressed').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m04-no-decision')).toBeTruthy();
    fireEvent.click(screen.getByTestId('m04-acad-nominate'));
    fireEvent.click(await screen.findByTestId('m04-acad-nominate-send', {}, T));
    await waitFor(() => expect(document.body.textContent).toMatch(/Nomination sent/), T);
  }, 40000);
  it('the academy page renders in Arabic', async () => {
    await renderPage(<LearnAcademyPage />, { persona: null, path: '/ar/learn/academies/ac-smr', route: '/ar/learn/academies/:academyId' });
    expect(await screen.findByTestId('m04-acad-modules', {}, T)).toBeTruthy();
    expect(document.body.textContent).toContain('المفاعلات المعيارية الصغيرة');
  }, 40000);
  it('my academies (k-ro): my place with stage and modules, and the capstone editor', async () => {
    await renderPage(<MyAcademiesPage />, { persona: 'k-ro', path: '/my/academies' });
    const place = await screen.findByTestId('m04-my-place', {}, T);
    expect(['modules', 'capstone_draft']).toContain(place.getAttribute('data-stage'));
    expect(screen.getByTestId('m04-my-capstone').getAttribute('data-status')).toBe('draft');
    expect(screen.getByTestId('m04-cap-submit')).toBeTruthy();
  }, 40000);
  it('my academies (ai-governance): capstones I review, sign-off with what it records', async () => {
    await renderPage(<MyAcademiesPage />, { persona: 'ai-governance', path: '/my/academies' });
    const list = await screen.findByTestId('m04-my-reviews', {}, T);
    expect(list.querySelectorAll('li').length).toBeGreaterThan(5);
    fireEvent.click(screen.getAllByTestId('m04-review-open')[0]);
    expect((await screen.findByTestId('m04-review-records', {}, T)).textContent).toMatch(/AI output verification|Prompt/);
    fireEvent.click(screen.getByTestId('m04-review-confirm'));
    await waitFor(() => expect(document.body.textContent).toMatch(/signed off; skills updated/), T);
  }, 40000);
  it('the console (training manager): nominations to decide, cohort roster, alumni', async () => {
    await renderPage(<TrainingAcademiesPage />, { persona: 'training-mgr', path: '/training/academies' });
    expect((await screen.findAllByTestId('m04-tra-decide', {}, T)).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-NUC-NET')).toBeTruthy(), T);
    fireEvent.click(screen.getByRole('tab', { name: /Cohorts/ }));
    expect((await screen.findByTestId('m04-tra-stats', {}, T)).textContent).toMatch(/\d/);
  }, 40000);
  it('instructors see the console read-only (no decide buttons)', async () => {
    await renderPage(<TrainingAcademiesPage />, { persona: 'k-instructor', path: '/training/academies' });
    await screen.findByTestId('m04-tra-tiles', {}, T);
    expect(screen.queryAllByTestId('m04-tra-decide').length).toBe(0);
  }, 40000);
});
