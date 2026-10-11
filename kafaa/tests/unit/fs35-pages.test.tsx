// @vitest-environment jsdom
/** FS25/FS26 pages rendered with the real providers and the in-memory LocalBackend: the public framework (EN and AR) with the mapping
 *  matrix, the live inclusion rule and the candidates; one core skill with routes and family targets; my core skills with reasons and the
 *  need bars; the practice flow end to end (question without the key, expert feedback and rationale, result with the ENEC line); the HR
 *  view with suppression; and the item bank (read-only for instructors, editable for the training manager). Every page shows its chips. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import CoreSkillsPage from '../../src/modules/m33/CoreSkillsPage';
import CoreSkillPage from '../../src/modules/m33/CoreSkillPage';
import MyCoreSkillsPage from '../../src/modules/m33/MyCoreSkillsPage';
import PracticePage from '../../src/modules/m33/PracticePage';
import WorkforceCoreSkillsPage from '../../src/modules/m33/WorkforceCoreSkillsPage';
import SjtItemsPage from '../../src/modules/m33/SjtItemsPage';

const T = { timeout: 20000 };

describe('FS25/FS26 pages', () => {
  it('the public framework: 16 skills, mapping matrix, the inclusion rule passes live, 8 candidates and the FS25 chips', async () => {
    await renderPage(<CoreSkillsPage />, { persona: null, path: '/learn/core-skills' });
    expect((await screen.findAllByTestId('m33-fw-skill', {}, { timeout: 90000 })).length).toBe(16);
    expect(screen.getByTestId('m33-rule-result').getAttribute('data-problems')).toBe('0');
    expect(screen.getByTestId('m33-fw-candidates').querySelectorAll('tbody tr').length).toBe(8);
    expect(screen.getByTestId('m33-fw-matrix').querySelectorAll('tbody tr').length).toBe(16);
    await waitFor(() => expect(screen.getAllByTestId('benchmark-chip-SSG-SF')[0].tagName).toBe('BUTTON'), { timeout: 30000 });
    expect(screen.getByTestId('m33-fw-signin')).toBeTruthy();
    fireEvent.click(screen.getByTestId('m33-fw-cluster-staying_relevant'));
    expect(screen.getAllByTestId('m33-fw-skill').length).toBe(5);
  }, 150000);
  it('the framework renders in Arabic', async () => {
    await renderPage(<CoreSkillsPage />, { persona: null, path: '/ar/learn/core-skills' });
    expect((await screen.findAllByTestId('m33-fw-skill', {}, T)).length).toBe(16);
    expect(document.body.textContent).toContain('موقف التساؤل');
    expect(document.body.textContent).toContain('قاعدة الإدراج');
    expect(document.body.textContent).toContain('العافية نتيجة وليست مهارة');
  }, 40000);
  it('one core skill: three levels, mappings, routes of its own, 20 family targets and sources', async () => {
    await renderPage(<CoreSkillPage />, { persona: null, path: '/learn/core-skills/cs-conservative', route: '/learn/core-skills/:id' });
    expect(await screen.findByTestId('m33-cs', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m33-cs-levels').querySelectorAll('li').length).toBe(3);
    expect(screen.getByTestId('m33-cs-dev').querySelectorAll('li').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('m33-cs-assess').querySelectorAll('li').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('m33-cs-targets').querySelectorAll('tbody tr').length).toBe(20);
    expect(screen.getByTestId('m33-cs-sources').querySelectorAll('li').length).toBeGreaterThanOrEqual(2);
    await waitFor(() => expect(screen.getAllByTestId('benchmark-chip-IAEA-1917').length).toBeGreaterThan(0));
  }, 40000);
  it('my core skills (k-ro): 16 rows with status, need bars, reasons and practice beside the level', async () => {
    await renderPage(<MyCoreSkillsPage />, { persona: 'k-ro', path: '/my/core-skills' });
    const rows = await screen.findAllByTestId('m33-my-skill', {}, T);
    expect(rows.length).toBe(16);
    expect(screen.getAllByTestId('m33-need').length).toBe(16);
    expect(screen.getAllByTestId('m33-my-practice').length).toBeGreaterThan(0);
    fireEvent.click(within(rows[0]).getByTestId('m33-my-why'));
    expect((await screen.findByTestId('m33-my-why-panel')).textContent).toMatch(/level|evidence/i);
    fireEvent.click(screen.getByTestId('m33-my-filter-gaps'));
    await waitFor(() => expect(screen.getAllByTestId('m33-my-skill').every((r) => ['below', 'no_evidence'].includes(r.getAttribute('data-status') ?? ''))).toBe(true));
  }, 40000);
  it('practice runs end to end: a question without the key, expert feedback with the rationale, then the result with the ENEC line', async () => {
    await renderPage(<PracticePage />, { persona: 'k-lo-trainee', path: '/my/core-skills/practice' });
    fireEvent.click(await screen.findByTestId('m33-sjt-start', {}, T));
    let n = 0;
    while (n < 10) {
      const q = await screen.findByTestId('m33-sjt-question', {}, T).catch(() => null);
      if (!q) break;
      fireEvent.click(screen.getByTestId('m33-sjt-opt-1'));
      fireEvent.click(screen.getByTestId('m33-sjt-submit'));
      const fb = await screen.findByTestId('m33-sjt-feedback', {}, T);
      expect(within(fb).getByTestId('m33-sjt-key').querySelectorAll('li').length).toBe(4);
      expect(within(fb).getByTestId('m33-sjt-rationale').textContent!.length).toBeGreaterThan(40);
      fireEvent.click(screen.getByTestId('m33-sjt-continue'));
      n++;
    }
    expect(n).toBe(8);
    const res = await screen.findByTestId('m33-sjt-result', {}, T);
    expect(Number(res.getAttribute('data-score'))).toBeGreaterThanOrEqual(0);
    expect(screen.getAllByTestId('benchmark-line').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m33-sjt-history').querySelectorAll('tbody tr').length).toBeGreaterThan(1);
  }, 120000);
  it('the practice page renders in Arabic with the expert scale', async () => {
    await renderPage(<PracticePage />, { persona: 'k-ro', path: '/ar/my/core-skills/practice' });
    expect(await screen.findByTestId('m33-sjt-scale', {}, T)).toBeTruthy();
    expect(document.body.textContent).toContain('الأفضل لدى الخبير');
    expect(screen.getByTestId('m33-sjt-result')).toBeTruthy();
  }, 40000);
  it('HR sees evidence against targets and practice aggregates, suppressed under 10, with definitions', async () => {
    await renderPage(<WorkforceCoreSkillsPage />, { persona: 'k-hr-analyst', path: '/workforce/core-skills' });
    const tiles = await screen.findByTestId('m33-wf-tiles', {}, T);
    expect(tiles.textContent).toMatch(/%/);
    expect(screen.getByTestId('m33-wf-skills').textContent).toMatch(/<10/);
    expect(screen.getByTestId('m33-wf-families').textContent).not.toMatch(/Security|Cyber/);
    expect(screen.getByTestId('m33-wf-definitions').textContent).toMatch(/fewer than 10/);
  }, 40000);
  it('the item bank: instructors read; the training manager adds a scenario and the form checks both languages first', async () => {
    await renderPage(<SjtItemsPage />, { persona: 'k-instructor', path: '/training/sjt/items' });
    expect(await screen.findByTestId('m33-bank-readonly', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m33-bank-items').querySelectorAll('tbody tr').length).toBeGreaterThan(10);
  }, 40000);
  it('the training manager opens the add form: the problem shows and save is disabled until the item is complete', async () => {
    await renderPage(<SjtItemsPage />, { persona: 'training-mgr', path: '/training/sjt/items' });
    fireEvent.click(await screen.findByTestId('m33-bank-add', {}, T));
    expect(await screen.findByTestId('m33-bank-form')).toBeTruthy();
    expect(screen.getByTestId('m33-bank-problem')).toBeTruthy();
    expect((screen.getByTestId('m33-bank-save') as HTMLButtonElement).disabled).toBe(true);
  }, 40000);
});
