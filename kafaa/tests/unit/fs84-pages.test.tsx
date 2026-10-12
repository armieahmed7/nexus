// @vitest-environment jsdom
/** FS76 pages: future-skills mode on /ask (anonymous public answers, staff personal answers, the intent catalogue, benchmark chips, Arabic RTL)
 *  and the governed intents on /admin/dalil (switch with a reason, the future set in the release gate). */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import AskPage from '../../src/modules/m13/AskPage';
import AdminDalilPage from '../../src/modules/m13/AdminDalilPage';

vi.setConfig({ testTimeout: 120000 });
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
const W = { timeout: 30000 };

async function askQ(q: string) {
  const input = await screen.findByTestId('m13-input', {}, W);
  fireEvent.change(input, { target: { value: q } });
  await waitFor(() => expect((screen.getByTestId('m13-send') as HTMLButtonElement).disabled).toBe(false), W);
  fireEvent.click(screen.getByTestId('m13-send'));
  await waitFor(() => expect(screen.getAllByTestId('m13-answer').length).toBeGreaterThan(0), W);
  const all = screen.getAllByTestId('m13-answer');
  return all[all.length - 1];
}

describe('FS76 future-skills mode on /ask', () => {
  it('anonymous: ?mode=future opens the public future mode with FS76 benchmark chips and the governed intent catalogue', async () => {
    await renderPage(<AskPage />, { persona: null, path: '/ask?mode=future' });
    const btn = await screen.findByTestId('m13-mode-future', {}, W);
    await waitFor(() => expect(btn.getAttribute('aria-checked')).toBe('true'), W);
    const banner = await screen.findByTestId('m13-future-banner', {}, W);
    expect(banner.getAttribute('data-personal')).toBe('false');
    expect(within(banner).getByTestId('benchmark-chips')).toBeTruthy();
    const side = await screen.findByTestId('m13-future-intents', {}, W);
    expect(within(side).getAllByTestId('m13-future-intent')).toHaveLength(4);
    expect(screen.queryByTestId('m13-mode-career')).toBeNull();
  });
  it('anonymous: a 2030 role question answers from the public map, cited, with no personal data', async () => {
    await renderPage(<AskPage />, { persona: null, path: '/ask?mode=future' });
    await screen.findByTestId('m13-future-intents', {}, W);
    const ans = await askQ('How will the senior reactor operator role change by 2030?');
    expect(ans.getAttribute('data-intent')).toBe('future.role_2030.public');
    const cites = within(ans).getByTestId('m13-citations');
    expect(cites.innerHTML).toContain('/careers/roles/senior-reactor-operator/transformation');
    expect(cites.innerHTML).not.toContain('/my/');
    expect(ans.textContent).toMatch(/no deployment decision/);
  });
  it('staff: future mode answers from my own records (personal banner, AI rung cards with WhyThis)', async () => {
    await renderPage(<AskPage />, { persona: 'k-ro', path: '/ask?mode=future' });
    const banner = await screen.findByTestId('m13-future-banner', {}, W);
    await waitFor(() => expect(banner.getAttribute('data-personal')).toBe('true'), W);
    await screen.findByTestId('m13-future-intents', {}, W);
    const ans = await askQ('Which AI rung do I need?');
    await waitFor(() => expect(screen.getAllByTestId('m13-answer').at(-1)!.getAttribute('data-intent')).toBe('future.ai_rung.personal'), W);
    const last = screen.getAllByTestId('m13-answer').at(-1)!;
    expect(within(last).getByTestId('m13-citations').innerHTML).toContain('/my/ai-fluency');
    const cards = within(last).getAllByTestId('m13-career-card');
    expect(cards.every((c) => c.getAttribute('data-kind') === 'rung')).toBe(true);
    expect(within(cards[0]).getByTestId('why-this')).toBeTruthy();
    void ans;
  });
  it('staff: the catalogue example button asks it; the turn is logged as a career turn through rpc.dalilFutureTurn', async () => {
    await renderPage(<AskPage />, { persona: 'k-ro', path: '/ask?mode=future' });
    const side = await screen.findByTestId('m13-future-intents', {}, W);
    const banner = await screen.findByTestId('m13-future-banner', {}, W);
    await waitFor(() => expect(banner.getAttribute('data-personal')).toBe('true'), W);
    fireEvent.click(within(side).getAllByTestId('m13-future-try')[2]);
    await waitFor(() => expect(screen.getAllByTestId('m13-answer').at(-1)!.getAttribute('data-intent')).toBe('future.skill_crosswalk.public'), W);
    const { getLocalBackend } = await import('../../src/data');
    const b = getLocalBackend();
    await waitFor(() => expect(b.raw('advisor_turns').some((t) => t.person_id === 'p-k-ro' && t.intent === 'future.skill_crosswalk.public' && t.submode === 'career')).toBe(true), W);
  });
  it('Arabic: future mode renders right to left with Arabic answers', async () => {
    await renderPage(<AskPage />, { persona: null, path: '/ar/ask?mode=future' });
    await screen.findByTestId('m13-future-intents', {}, W);
    const ans = await askQ('كيف سيتغير دور مشغل المفاعل الأول بحلول 2030؟');
    const p = ans.querySelector('p')!;
    expect(p.getAttribute('dir')).toBe('rtl');
    expect(p.textContent).toMatch(/[؀-ۿ]/);
  });
});

describe('FS76 on /admin/dalil', () => {
  it('the AI owner switches an intent off with a reason (confirm dialog); the catalogue shows it off', async () => {
    await renderPage(<AdminDalilPage />, { persona: 'ai-governance', path: '/admin/dalil' });
    fireEvent.click(await screen.findByRole('tab', { name: /Future skills/ }, W));
    const list = await screen.findByTestId('m13-intent-list', {}, W);
    const rung = within(list).getAllByTestId('m13-intent').find((x) => x.getAttribute('data-intent') === 'future.ai_rung')!;
    fireEvent.click(within(rung).getByTestId('m13-intent-toggle'));
    const confirm = await screen.findByTestId('confirm-action', {}, W);
    expect((confirm as HTMLButtonElement).disabled).toBe(true); // a reason is required
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Ladder targets under review this week' } });
    await waitFor(() => expect((screen.getByTestId('confirm-action') as HTMLButtonElement).disabled).toBe(false), W);
    fireEvent.click(screen.getByTestId('confirm-action'));
    await waitFor(() => expect(within(screen.getByTestId('m13-intent-list')).getAllByTestId('m13-intent').find((x) => x.getAttribute('data-intent') === 'future.ai_rung')!.getAttribute('data-enabled')).toBe('false'), W);
    const { getLocalBackend } = await import('../../src/data');
    expect(getLocalBackend().raw('audit_events').some((a) => a.action === 'dalil.intent')).toBe(true);
  });
  it('an auditor reads the intents but cannot switch them', async () => {
    await renderPage(<AdminDalilPage />, { persona: 'k-auditor', path: '/admin/dalil' });
    fireEvent.click(await screen.findByRole('tab', { name: /Future skills/ }, W));
    const list = await screen.findByTestId('m13-intent-list', {}, W);
    expect(within(list).getAllByTestId('m13-intent')).toHaveLength(4);
    expect(within(list).queryByTestId('m13-intent-toggle')).toBeNull();
  });
  it('the evaluation run includes the future-skills set and the gate passes', async () => {
    await renderPage(<AdminDalilPage />, { persona: 'k-admin', path: '/admin/dalil' });
    fireEvent.click(await screen.findByRole('tab', { name: /Evaluation/ }, W));
    fireEvent.click(await screen.findByTestId('m13-eval-run', {}, W));
    const fut = await screen.findByTestId('m13-eval-future', {}, { timeout: 90000 });
    expect(fut.textContent).toMatch(/Future skills mode/);
    expect(fut.textContent).toMatch(/100/);
    const res = screen.getByTestId('m13-eval-result');
    expect(res.textContent).toMatch(/Pass|Passed|pass/);
  });
});
