// @vitest-environment jsdom
/**
 * F07 component tests: /my/coach renders the ranked feed with "Why this?" on every card, has no points, streak or
 * leaderboard UI, answers "Ask the coach" with citations, works in Arabic (RTL), and /my/coach/insights shows suppressed
 * aggregates to HR. Rendered with the real providers and the in-memory LocalBackend (tests/unit/g4-harness.tsx).
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within, waitFor } from '@testing-library/react';
import { renderG4 } from './g4-harness';
import MyCoachPage from '../../src/modules/m19/MyCoachPage';
import CoachInsightsPage from '../../src/modules/m19/CoachInsightsPage';
import en from '../../src/i18n/m19.en.json';

const W = { timeout: 8000 };
// The page states the policy in words ("no points, streaks or rankings"); remove those sentences, then nothing else may
// mention gamification.
const POLICY = [en.coach.intro, en.goal.noStreaks, en.coach.privacyBody];
const GAMIFIED = /\b(points?|pts|xp|streaks?|leaderboards?|ranking|top performer|level up|badges? earned)\b/i;

describe('F07 /my/coach page', () => {
  it('k-ro sees 5 to 8 ranked cards, each with a reason and a "Why this?" disclosure', async () => {
    await renderG4(<MyCoachPage />, { persona: 'k-ro', path: '/my/coach' });
    const feed = await screen.findByTestId('m19-feed', {}, W);
    const cards = within(feed).getAllByTestId('m19-card');
    expect(cards.length).toBeGreaterThanOrEqual(5);
    expect(cards.length).toBeLessThanOrEqual(8);
    for (const c of cards) {
      expect(within(c).getByTestId('why-this')).toBeTruthy();
      expect(within(c).getByTestId('m19-top-reason').textContent!.trim().length).toBeGreaterThan(5);
    }
    // the first cards are the pinned mandatory items of the RO role
    expect(cards[0].getAttribute('data-pinned')).toBe('must_keep');
    fireEvent.click(within(cards[2]).getByTestId('why-this'));
    expect(within(cards[2]).getByTestId('why-this-panel').querySelectorAll('li').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m19-goal')).toBeTruthy();
    expect(screen.getAllByText(/\b4 h a week\b/).length).toBeGreaterThan(0);
  });
  it('has no points, streak or leaderboard UI', async () => {
    const { container } = await renderG4(<MyCoachPage />, { persona: 'k-ro', path: '/my/coach' });
    await screen.findByTestId('m19-feed', {}, W);
    let text = container.textContent ?? '';
    for (const p of POLICY) text = text.split(p).join(' ');
    expect(text).not.toMatch(GAMIFIED);
    const attrs = [...container.querySelectorAll('*')].map((el) => `${el.getAttribute('data-testid') ?? ''} ${el.getAttribute('class') ?? ''} ${el.getAttribute('aria-label') ?? ''}`).join(' ');
    expect(attrs).not.toMatch(/streak|leaderboard|points|xp-|rank-badge/i);
  });
  it('"Not relevant" hides a card and lists it under Hidden', async () => {
    await renderG4(<MyCoachPage />, { persona: 'k-ro', path: '/my/coach' });
    const feed = await screen.findByTestId('m19-feed', {}, W);
    const card = within(feed).getAllByTestId('m19-card').find((c) => !c.getAttribute('data-pinned'))!;
    const title = card.querySelector('h3')!.textContent!;
    fireEvent.click(within(card).getByTestId('m19-dismiss'));
    await waitFor(() => expect(within(screen.getByTestId('m19-feed')).queryByText(title)).toBeNull(), W);
    fireEvent.click(screen.getByRole('tab', { name: /Hidden/ }));
    expect(await within(await screen.findByTestId('m19-hidden', {}, W)).findByText(title)).toBeTruthy();
  });
  it('Ask the coach answers with catalogue citations', async () => {
    await renderG4(<MyCoachPage />, { persona: 'k-ro', path: '/my/coach' });
    await screen.findByTestId('m19-feed', {}, W);
    fireEvent.click(screen.getByRole('tab', { name: /Ask the coach/ }));
    fireEvent.change(await screen.findByTestId('m19-ask-input'), { target: { value: 'Which course covers radiation protection basics?' } });
    fireEvent.click(screen.getByTestId('m19-ask-submit'));
    const list = await screen.findByTestId('m19-ask-citations', {}, W);
    expect(within(list).getByText('Radiation protection technician initial')).toBeTruthy();
  });
  it('renders in Arabic (RTL) with Arabic labels', async () => {
    await renderG4(<MyCoachPage />, { persona: 'k-ro', path: '/ar/my/coach' });
    await screen.findByTestId('m19-feed', {}, W);
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getAllByText('لماذا هذا؟').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('مدرّب التعلّم');
  });
  it('a persona without a staff role sees an empty state, not a crash', async () => {
    await renderG4(<MyCoachPage />, { persona: 'k-contractor', path: '/my/coach' });
    expect(await screen.findByTestId('empty-state', {}, W)).toBeTruthy();
  });
});

describe('F07 /my/coach/insights page', () => {
  it('HR sees acceptance by kind and by family, with small groups suppressed', async () => {
    await renderG4(<CoachInsightsPage />, { persona: 'k-hr-analyst', path: '/my/coach/insights' });
    const byKind = await screen.findByTestId('m19-insights-kind', {}, W);
    expect(within(byKind).getAllByRole('row').length).toBeGreaterThan(3);
    const byFamily = screen.getByTestId('m19-insights-family');
    expect(within(byFamily).getAllByText('<10').length).toBeGreaterThan(0);
  });
  it('an employee gets an error state from the refused RPC, never data', async () => {
    await renderG4(<CoachInsightsPage />, { persona: 'k-ro', path: '/my/coach/insights' });
    expect(await screen.findByTestId('error-state', {}, W)).toBeTruthy();
  });
});
