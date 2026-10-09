// @vitest-environment jsdom
/** F16/F17 pages rendered with the real providers and the in-memory LocalBackend: the ladder with required programmes for the
 *  shift track, readiness with "Why this?", the 360 threshold, the decision queue, suppressed HR aggregates, communities, the
 *  moderation queue, the expert finder (opted-in only) and the session search in English and Arabic. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import LeadershipPage from '../../src/modules/m22/LeadershipPage';
import ProgrammePage from '../../src/modules/m22/ProgrammePage';
import Leadership360Page from '../../src/modules/m22/Leadership360Page';
import NominationsPage from '../../src/modules/m22/NominationsPage';
import LeadershipInsightsPage from '../../src/modules/m22/LeadershipInsightsPage';
import CommunitiesPage from '../../src/modules/m22/CommunitiesPage';
import CommunityPage from '../../src/modules/m22/CommunityPage';
import ThreadPage from '../../src/modules/m22/ThreadPage';
import ExpertsPage from '../../src/modules/m22/ExpertsPage';
import SessionsPage from '../../src/modules/m22/SessionsPage';

const T = { timeout: 15000 };

describe('F16 pages', () => {
  it('the academy shows k-ro the ladder, the shift track and INTILAQA/LET as required, with reasons on recommendations', async () => {
    await renderPage(<LeadershipPage />, { persona: 'k-ro', path: '/leadership' });
    await screen.findByTestId('m22-ladder', {}, T);
    expect(screen.getByTestId('m22-shift-track')).toBeTruthy();
    const reco = screen.getByTestId('m22-reco');
    expect(within(reco).getAllByTestId('m22-required').length).toBeGreaterThanOrEqual(2);
    expect(reco.textContent).toMatch(/INTILAQA/);
    expect(reco.textContent).toMatch(/Leading Effective Teams/);
    expect(within(reco).getAllByTestId('m22-why').length).toBe(within(reco).getAllByTestId('m22-programme').length);
    fireEvent.click(screen.getByTestId('m22-why-ready'));
    expect((await screen.findByTestId('m22-why-ready-panel')).textContent).toMatch(/ready on the leadership competencies/);
    expect(screen.getAllByTestId('m22-sources').length).toBeGreaterThan(5);
  }, 30000);
  it('renders in Arabic', async () => {
    await renderPage(<LeadershipPage />, { persona: 'k-ro', path: '/ar/leadership' });
    const ladder = await screen.findByTestId('m22-ladder', {}, T);
    expect(ladder.textContent).toMatch(/قائد الخط الأول/);
  });
  it('the programme page shows the published facts with the CNS source and the manager can nominate', async () => {
    await renderPage(<ProgrammePage />, { persona: 'sro', path: '/leadership/programmes/prog-intilaqa', route: '/leadership/programmes/:id' });
    await screen.findByTestId('m22-programme-skills', {}, T);
    expect(document.body.textContent).toMatch(/285/);
    expect(screen.getAllByTestId('m22-sources')[0].textContent).toMatch(/10th CNS/);
    fireEvent.click(screen.getByTestId('m22-nominate'));
    expect(await screen.findByTestId('m22-nominate-reason')).toBeTruthy();
  });
  it('the 360 page shows "not enough responses" for k-ro', async () => {
    await renderPage(<Leadership360Page />, { persona: 'k-ro', path: '/leadership/360' });
    expect(await screen.findByTestId('m22-360-not-enough', {}, T)).toBeTruthy();
  }, 20000);
  it('the 360 page shows the behaviour averages for sro', async () => {
    await renderPage(<Leadership360Page />, { persona: 'sro', path: '/leadership/360' });
    const res = await screen.findByTestId('m22-360-results', {}, T);
    expect(res.querySelectorAll('li')).toHaveLength(8);
  }, 20000);
  it('sro can rate k-ro from the "Give feedback" tab', async () => {
    await renderPage(<Leadership360Page />, { persona: 'sro', path: '/leadership/360' });
    await screen.findByTestId('m22-360-results', {}, T);
    fireEvent.click(screen.getByRole('tab', { name: /Give feedback/ }));
    const inbox = await screen.findByTestId('m22-360-inbox', {}, T);
    fireEvent.click(within(inbox).getAllByTestId('m22-360-rate')[0]);
    const sheet = await screen.findByTestId('m22-360-sheet');
    for (const fs of Array.from(sheet.querySelectorAll('fieldset'))) fireEvent.click(fs.querySelectorAll('input')[3]);
    fireEvent.click(screen.getByTestId('m22-360-submit'));
    fireEvent.click(await screen.findByTestId('confirm-action'));
    await waitFor(() => expect(getLocalBackend().raw('leadership_360_requests').filter((q) => q.rater_id === 'p-sro' && q.cycle === '2026-H2' && q.status === 'submitted').length).toBe(1), T);
  }, 20000);
  it('the HR authority sees the decision queue with approve and decline', async () => {
    await renderPage(<NominationsPage />, { persona: 'chco', path: '/leadership/nominations' });
    const q = await screen.findByTestId('m22-nom-queue', {}, T);
    expect(within(q).getAllByTestId('m22-nom-card').length).toBeGreaterThanOrEqual(5);
    expect(within(q).getAllByTestId('m22-nom-approve').length).toBeGreaterThan(0);
  }, 20000);
  it('HR insights suppress small grades', async () => {
    await renderPage(<LeadershipInsightsPage />, { persona: 'chco', path: '/leadership/insights' });
    const hm = await screen.findByTestId('m22-insights-heatmap', {}, T);
    expect(hm.textContent).toMatch(/<10/);
    expect(hm.textContent).toMatch(/Senior/);
  });
});

describe('F17 pages', () => {
  it('lists the seven communities with membership and upcoming sessions', async () => {
    await renderPage(<CommunitiesPage />, { persona: 'k-ro', path: '/communities' });
    const list = await screen.findByTestId('m22-communities', {}, T);
    expect(within(list).getAllByTestId('m22-community-card')).toHaveLength(7);
    expect(screen.getByTestId('m22-events').querySelectorAll('li').length).toBeGreaterThan(0);
  });
  it('a steward sees the held first post in the moderation tab', async () => {
    await renderPage(<CommunityPage />, { persona: 'sro', path: '/communities/cop-ops', route: '/communities/:id' });
    await screen.findByTestId('m22-threads', {}, T);
    fireEvent.click(screen.getByRole('tab', { name: /Moderation/ }));
    const q = await screen.findByTestId('m22-queue', {}, T);
    expect(q.textContent).toMatch(/Self-checking habits/);
  });
  it('a thread shows its posts and a reply box for members', async () => {
    await renderPage(<ThreadPage />, { persona: 'k-ro', path: '/communities/thread/th-001', route: '/communities/thread/:threadId' });
    const posts = await screen.findByTestId('m22-posts', {}, T);
    expect(posts.querySelectorAll('li').length).toBe(4);
    await waitFor(() => expect(screen.getByTestId('m22-reply')).toBeTruthy(), T);
  });
  it('the expert finder lists opted-in experts with "Why this?" and never k-ro (not opted in)', async () => {
    await renderPage(<ExpertsPage />, { persona: 'qc-inspector', path: '/communities/experts' });
    const list = await screen.findByTestId('m22-experts', {}, T);
    const cards = within(list).getAllByTestId('m22-expert');
    expect(cards.length).toBeGreaterThan(10);
    expect(within(list).getAllByTestId('m22-expert-why')).toHaveLength(cards.length);
    expect(list.textContent).not.toMatch(/Reactor Operator \(k-ro\)/);
  });
  it('session search finds sessions in English and Arabic', async () => {
    await renderPage(<SessionsPage />, { persona: 'k-ro', path: '/communities/sessions' });
    const input = await screen.findByTestId('m22-session-search', {}, T);
    fireEvent.change(input, { target: { value: 'الذكاء الاصطناعي' } });
    await waitFor(() => expect(screen.getByTestId('m22-sessions').textContent).toMatch(/Artificial intelligence at work/), T);
    fireEvent.change(input, { target: { value: 'outage' } });
    await waitFor(() => expect(screen.getByTestId('m22-sessions').textContent).toMatch(/Outage lessons learned/), T);
  });
});
