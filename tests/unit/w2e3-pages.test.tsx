// @vitest-environment jsdom
/**
 * F13 + F14 component tests (W2 · E3): ranked mentor cards with "Why this?", the own-line-manager note, private session notes
 * on the agreement page, the programme dashboard for the training manager, the refresher round (keys only after submitting,
 * no gamification, Arabic RTL) and the instructor's aggregate view. Real providers + the in-memory LocalBackend.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within, waitFor } from '@testing-library/react';
import { renderG4 } from './g4-harness';
import MyMentoringPage from '../../src/modules/m04/MyMentoringPage';
import MentoringAgreementPage from '../../src/modules/m04/MentoringAgreementPage';
import MentoringProgrammePage from '../../src/modules/m04/MentoringProgrammePage';
import RefreshPage from '../../src/modules/m19/RefreshPage';
import RefresherInsightsPage from '../../src/modules/m19/RefresherInsightsPage';
import en from '../../src/i18n/m19.en.json';
import ar from '../../src/i18n/m19.ar.json';

const W = { timeout: 10000 };
const AG = '/my/mentoring/:agreementId';
const GAMIFIED = /\b(points?|pts|xp|streaks?|leaderboards?|ranking|top performer|level up|badges? earned)\b/i;

describe('F13 /my/mentoring', () => {
  it('k-ro sees ranked mentor cards, each with a reason and "Why this?"; never their own line manager', async () => {
    await renderG4(<MyMentoringPage />, { persona: 'k-ro', path: '/my/mentoring' });
    const list = await screen.findByTestId('m04-mentor-matches', {}, W);
    const cards = within(list).getAllByTestId('m04-match-card');
    expect(cards.length).toBeGreaterThanOrEqual(3);
    for (const c of cards) {
      expect(within(c).getByTestId('why-this')).toBeTruthy();
      expect(within(c).getByTestId('m04-top-reason').textContent!.trim().length).toBeGreaterThan(5);
    }
    expect(cards.map((c) => c.getAttribute('data-mentor'))).not.toContain('mt-6'); // the SRO, k-ro's line manager
    fireEvent.click(within(cards[0]).getByTestId('why-this'));
    expect(within(cards[0]).getByTestId('why-this-panel').querySelectorAll('li').length).toBeGreaterThan(1);
  });
  it('outage-planner is told why their line manager is not suggested', async () => {
    await renderG4(<MyMentoringPage />, { persona: 'outage-planner', path: '/my/mentoring' });
    expect(await screen.findByTestId('m04-own-manager-note', {}, W)).toBeTruthy();
    const cards = within(await screen.findByTestId('m04-mentor-matches', {}, W)).getAllByTestId('m04-match-card');
    expect(cards.map((c) => c.getAttribute('data-mentor'))).not.toContain('mt-12');
  });
  it('renders in Arabic (RTL)', async () => {
    await renderG4(<MyMentoringPage />, { persona: 'k-ro', path: '/ar/my/mentoring' });
    await screen.findByTestId('m04-mentor-matches', {}, W);
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getAllByText('لماذا هذا؟').length).toBeGreaterThan(0);
  });
});

describe('F13 /my/mentoring/:agreementId: private notes', () => {
  const MINE_QC = 'Follow up on the escalation example.';
  const MINE_SQ = 'Remember to ask about the qualification route.';
  it('the mentee sees their own private note and not the mentor\'s', async () => {
    await renderG4(<MentoringAgreementPage />, { persona: 'qc-inspector', path: '/my/mentoring/ma-mr-f13-001', route: AG });
    const sessions = await screen.findByTestId('m04-sessions', {}, W);
    const notes = within(sessions).getAllByTestId('m04-private-note');
    expect(notes.length).toBe(1);
    expect(notes[0].textContent).toContain(MINE_QC);
    expect(sessions.textContent).not.toContain(MINE_SQ);
    expect(screen.getByTestId('m04-goals')).toBeTruthy();
  });
  it('the mentor sees their own two notes only', async () => {
    await renderG4(<MentoringAgreementPage />, { persona: 'sq-lead', path: '/my/mentoring/ma-mr-f13-001', route: AG });
    const sessions = await screen.findByTestId('m04-sessions', {}, W);
    expect(within(sessions).getAllByTestId('m04-private-note').length).toBe(2);
    expect(sessions.textContent).toContain(MINE_SQ);
    expect(screen.getByTestId('m04-log-session')).toBeTruthy();
  });
  it('a line manager or an outsider does not see the agreement at all', async () => {
    for (const p of ['head-sq', 'training-mgr']) {
      const { unmount } = await renderG4(<MentoringAgreementPage />, { persona: p, path: '/my/mentoring/ma-mr-f13-001', route: AG });
      await waitFor(() => expect(screen.queryAllByTestId('empty-state').length + screen.queryAllByTestId('error-state').length).toBeGreaterThan(0), W);
      expect(screen.queryByTestId('m04-sessions')).toBeNull();
      expect(document.body.textContent).not.toContain(MINE_QC);
      unmount();
    }
  });
});

describe('F13 /my/mentoring/programme', () => {
  it('the training manager sees aggregates by type with small cells suppressed, plus nominations', async () => {
    await renderG4(<MentoringProgrammePage />, { persona: 'training-mgr', path: '/my/mentoring/programme' });
    const dash = await screen.findByTestId('m04-programme', {}, W);
    expect(dash.querySelectorAll('[data-suppressed]').length).toBeGreaterThan(0);
    expect(dash.textContent).toMatch(/Knowledge transfer/);
    expect(await screen.findByTestId('m04-sme-nominees', {}, W)).toBeTruthy();
  });
  it('a line manager sees only the nominations for their own line, no dashboard', async () => {
    await renderG4(<MentoringProgrammePage />, { persona: 'head-sq', path: '/my/mentoring/programme' });
    await screen.findByTestId('m04-sme-nominees', {}, W);
    expect(screen.queryByTestId('m04-programme')).toBeNull();
  });
});

describe('F14 /my/coach/refresh', () => {
  it('serves up to five questions with "Why this?", no key before checking; checking shows the explanation and the new box', async () => {
    const { container } = await renderG4(<RefreshPage />, { persona: 'k-ro', path: '/my/coach/refresh' });
    // k-ro has used this week's five (seeded); ask for an extra round if needed
    const extra = await waitFor(() => screen.queryByTestId('m19-refresh-set') ?? screen.getByTestId('m19-refresh-extra'), W);
    if (extra.getAttribute('data-testid') === 'm19-refresh-extra') fireEvent.click(extra);
    const set = await screen.findByTestId('m19-refresh-set', {}, W);
    const qs = within(set).getAllByTestId('m19-refresh-q');
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.length).toBeLessThanOrEqual(5);
    for (const q of qs) expect(within(q).getByTestId('why-this')).toBeTruthy();
    expect(screen.queryAllByTestId('m19-refresh-explain').length).toBe(0);
    fireEvent.click(within(qs[0]).getAllByRole('radio')[0]);
    fireEvent.click(screen.getByTestId('m19-refresh-submit'));
    const ex = await screen.findByTestId('m19-refresh-explain', {}, W);
    expect(ex.textContent).toMatch(/box/i);
    expect(screen.getByTestId('m19-refresh-summary').textContent).toMatch(/1/);
    expect(screen.getByTestId('m19-confidence')).toBeTruthy();
    let text = container.textContent ?? '';
    for (const p of [en.refresh.noGamesBody, en.refresh.noGamesTitle]) text = text.split(p).join(' ');
    expect(text).not.toMatch(GAMIFIED);
    const attrs = [...container.querySelectorAll('*')].map((el) => `${el.getAttribute('data-testid') ?? ''} ${el.getAttribute('class') ?? ''}`).join(' ');
    expect(attrs).not.toMatch(/streak|leaderboard|points|xp-|rank-badge/i);
  });
  it('renders in Arabic (RTL) with Arabic labels', async () => {
    await renderG4(<RefreshPage />, { persona: 'k-ro', path: '/ar/my/coach/refresh' });
    await screen.findByTestId('m19-cadence', {}, W);
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(ar.routes['my-coach-refresh'].title);
  });
});

describe('F14 /training/refreshers', () => {
  it('the training manager sees item difficulty aggregates, suppressed under 10, and flags', async () => {
    await renderG4(<RefresherInsightsPage />, { persona: 'training-mgr', path: '/training/refreshers' });
    const v = await screen.findByTestId('m19-rstats', {}, W);
    expect(v.textContent).toMatch(/Very easy/);
    expect(v.textContent).toMatch(/Very hard/);
    expect(v.textContent).toMatch(new RegExp(en.rstats.privacyTitle));
    expect(v.textContent).not.toMatch(/p-k-ro|Khalid/);
  });
  it('a licensed operator is refused', async () => {
    await renderG4(<RefresherInsightsPage />, { persona: 'k-ro', path: '/training/refreshers' });
    expect(await screen.findByTestId('error-state', {}, W)).toBeTruthy();
  });
});
