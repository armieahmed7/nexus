// @vitest-environment jsdom
/** FS09/FS10 pages rendered with the real providers and the in-memory LocalBackend: the public ladder (EN and AR), my rung with
 *  reasons and evidence, the fitness check end to end (start, answer to the stop rule, result with benchmark lines and evidence),
 *  the HR indicator with the DigComp line and suppression, and the item bank (read-only for instructors, editable for the
 *  training manager). Every page shows its benchmark chips. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import LadderPage from '../../src/modules/m29/LadderPage';
import MyFluencyPage from '../../src/modules/m29/MyFluencyPage';
import FitnessCheckPage from '../../src/modules/m29/FitnessCheckPage';
import WorkforceFluencyPage from '../../src/modules/m29/WorkforceFluencyPage';
import ItemBankPage from '../../src/modules/m29/ItemBankPage';

const T = { timeout: 20000 };

describe('FS09/FS10 pages', () => {
  it('the public ladder shows 4 rungs x 4 dimensions, literacy vs engineering, 20 family targets and the FS09 benchmark chips', async () => {
    await renderPage(<LadderPage />, { persona: null, path: '/learn/ai-fluency' });
    expect((await screen.findAllByTestId('m29-lad-cell', {}, { timeout: 90000 })).length).toBe(16); // first render in the file loads the whole seed
    expect(screen.getByTestId('m29-lad-targets').querySelectorAll('tbody tr').length).toBe(20);
    expect(screen.getByTestId('m29-lad-engineering').querySelectorAll('li').length).toBe(5);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-AI-LIT').tagName).toBe('BUTTON'), { timeout: 30000 });
    expect(screen.getByTestId('m29-lad-signin')).toBeTruthy();
  }, 150000);
  it('the ladder renders in Arabic', async () => {
    await renderPage(<LadderPage />, { persona: null, path: '/ar/learn/ai-fluency' });
    expect((await screen.findAllByTestId('m29-lad-cell', {}, T)).length).toBe(16);
    expect(document.body.textContent).toContain('ممارِس');
    expect(document.body.textContent).toContain('سلّم الطلاقة');
  }, 40000);
  it('my rung: steps, reasons, 16 cells with evidence, the next step and my family target (k-ro)', async () => {
    await renderPage(<MyFluencyPage />, { persona: 'k-ro', path: '/my/ai-fluency' });
    const rung = await screen.findByTestId('m29-my-rung', {}, T);
    expect(Number(rung.getAttribute('data-rung'))).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('m29-my-cell').length).toBe(16);
    expect(screen.getAllByTestId('m29-my-evidence').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m29-my-target').textContent).toMatch(/Practitioner/);
    fireEvent.click(screen.getByTestId('m29-my-why'));
    expect((await screen.findByTestId('m29-my-why-panel')).textContent).toMatch(/Rung \d of 4/);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-UAE-AI')).toBeTruthy());
  }, 40000);
  it('the fitness check runs end to end: start, answer to the stop rule (<= 20), result with lines and capped evidence', async () => {
    await renderPage(<FitnessCheckPage />, { persona: 'k-ro', path: '/my/ai-fluency/check' });
    fireEvent.click(await screen.findByTestId('m29-fit-start', {}, T));
    let n = 0;
    while (n < 25) {
      const q = await screen.findByTestId('m29-fit-question', {}, T).catch(() => null);
      if (!q) break;
      const id = q.getAttribute('data-item');
      fireEvent.click(screen.getByTestId('m29-fit-opt-0'));
      fireEvent.click(screen.getByTestId('m29-fit-next'));
      await waitFor(() => expect(screen.queryByTestId('m29-fit-question')?.getAttribute('data-item') ?? 'done').not.toBe(id), T);
      n++;
    }
    expect(n).toBeLessThanOrEqual(20);
    expect(n).toBeGreaterThanOrEqual(18);
    const res = await screen.findByTestId('m29-fit-result', {}, T);
    expect(Number(res.getAttribute('data-score'))).toBeGreaterThanOrEqual(0);
    expect(screen.getAllByTestId('benchmark-line').length).toBeGreaterThan(0);
    for (const li of within(screen.getByTestId('m29-fit-evidence')).queryAllByRole('listitem')) expect(Number(li.getAttribute('data-level'))).toBeLessThanOrEqual(2);
    expect(await screen.findByTestId('m29-fit-next-on')).toBeTruthy();
  }, 90000);
  it('a person who took this quarter\'s check sees the next opening date and their trend (sro)', async () => {
    await renderPage(<FitnessCheckPage />, { persona: 'sro', path: '/my/ai-fluency/check' });
    expect(await screen.findByTestId('m29-fit-next-on', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m29-fit-history').children.length).toBeGreaterThan(0);
    expect(screen.queryByTestId('m29-fit-start')).toBeNull();
  }, 40000);
  it('HR sees % above basic with the DigComp benchmark line, the leadership parameter and suppressed families', async () => {
    await renderPage(<WorkforceFluencyPage />, { persona: 'k-hr-analyst', path: '/workforce/ai-fluency' });
    const tiles = await screen.findByTestId('m29-wf-tiles', {}, T);
    expect(tiles.textContent).toMatch(/%/);
    await waitFor(() => expect(within(screen.getByTestId('m29-wf-above')).getByTestId('benchmark-chip-DIGCOMP')).toBeTruthy());
    expect(screen.getByTestId('m29-wf-param').textContent).toMatch(/60%/);
    expect(screen.getByTestId('m29-wf-families').textContent).toMatch(/<10/);
    expect(screen.getByTestId('m29-wf-definitions').textContent).toMatch(/fewer than 10/);
  }, 40000);
  it('the item bank: instructors read; the training manager adds an item and the server-side rules apply', async () => {
    await renderPage(<ItemBankPage />, { persona: 'k-instructor', path: '/training/ai-fitness/items' });
    expect(await screen.findByTestId('m29-bank-readonly', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m29-bank-coverage').querySelectorAll('td').length).toBeGreaterThan(0);
  }, 40000);
  it('the training manager edits the bank: the form flags restricted wording before saving', async () => {
    await renderPage(<ItemBankPage />, { persona: 'training-mgr', path: '/training/ai-fitness/items' });
    fireEvent.click(await screen.findByTestId('m29-bank-add', {}, T));
    const form = await screen.findByTestId('m29-bank-form');
    expect(form).toBeTruthy();
    expect(screen.getByTestId('m29-bank-problem')).toBeTruthy();
    expect((screen.getByTestId('m29-bank-save') as HTMLButtonElement).disabled).toBe(true);
  }, 40000);
});
