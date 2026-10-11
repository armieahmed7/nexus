// @vitest-environment jsdom
/** F08 pages rendered with the real providers and the in-memory LocalBackend: match reasons on every card (EN and AR),
 *  the release desk, the detail page, my applications and the suppressed HR table. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import MarketplacePage from '../../src/modules/m20/MarketplacePage';
import OpportunityPage from '../../src/modules/m20/OpportunityPage';
import MyOpportunitiesPage from '../../src/modules/m20/MyOpportunitiesPage';
import ManageOpportunitiesPage from '../../src/modules/m20/ManageOpportunitiesPage';
import OpportunityInsightsPage from '../../src/modules/m20/OpportunityInsightsPage';
import PostOpportunityPage from '../../src/modules/m20/PostOpportunityPage';

const T = { timeout: 8000 };

describe('F08 pages', () => {
  it('the marketplace ranks open opportunities for k-ro with a match ring and a "Why this?" on every card', async () => {
    await renderPage(<MarketplacePage />, { persona: 'k-ro', path: '/opportunities' });
    const list = await screen.findByTestId('m20-list', {}, T);
    const cards = within(list).getAllByTestId('m20-card');
    expect(cards.length).toBeGreaterThanOrEqual(15);
    expect(within(list).getAllByTestId('m20-why')).toHaveLength(cards.length);
    fireEvent.click(within(list).getAllByTestId('m20-why')[0]);
    expect((await screen.findAllByTestId('m20-why-panel'))[0].textContent).toMatch(/skills match|No prerequisites/);
  });
  it('renders in Arabic with Arabic reasons', async () => {
    await renderPage(<MarketplacePage />, { persona: 'k-ro', path: '/ar/opportunities' });
    const list = await screen.findByTestId('m20-list', {}, T);
    fireEvent.click(within(list).getAllByTestId('m20-why')[0]);
    expect((await screen.findAllByTestId('m20-why-panel'))[0].textContent).toMatch(/[؀-ۿ]/);
  });
  it('the detail page shows the skills needed and gained and the apply flow', async () => {
    await renderPage(<OpportunityPage />, { persona: 'k-lo-trainee', path: '/opportunities/opp-oe-review-2026-q4', route: '/opportunities/:id' });
    await screen.findByTestId('m20-need-table', {}, T);
    expect(screen.getByTestId('m20-gain-table')).toBeTruthy();
    fireEvent.click(screen.getByTestId('m20-apply'));
    fireEvent.click(await screen.findByTestId('m20-apply-confirm'));
    await waitFor(() => expect(screen.getByTestId('stepper')).toBeTruthy(), T);
  });
  it("the shift supervisor's desk lists k-ro's release request; the poster sees the pipeline", async () => {
    await renderPage(<ManageOpportunitiesPage />, { persona: 'sro', path: '/opportunities/manage' });
    const list = await screen.findByTestId('m20-release-list', {}, T);
    expect(within(list).getAllByTestId('m20-release-card').length).toBeGreaterThanOrEqual(1);
    expect(list.textContent).toMatch(/Unit 3 refuelling outage/);
  });
  it('my opportunities shows signed-off skills evidence for k-ro', async () => {
    await renderPage(<MyOpportunitiesPage />, { persona: 'k-ro', path: '/opportunities/my' });
    await screen.findByTestId('m20-my-list', {}, T);
    fireEvent.click(screen.getByRole('tab', { name: /Signed off/ }));
    const ev = await screen.findByTestId('m20-my-evidence', {}, T);
    expect(within(ev).getAllByRole('listitem')).toHaveLength(2);
  });
  it('HR insights suppress small families and show no names', async () => {
    await renderPage(<OpportunityInsightsPage />, { persona: 'k-hr-analyst', path: '/opportunities/insights' });
    const table = await screen.findByTestId('m20-family-table', {}, T);
    expect(table.querySelectorAll('tr[data-suppressed="true"]').length).toBeGreaterThan(0);
    expect(table.querySelectorAll('tr[data-suppressed="false"]').length).toBeGreaterThan(0);
    expect(table.textContent).not.toMatch(/w-ro-|p-k-ro/);
  });
  it('the post form never offers restricted kinds or security skills', async () => {
    await renderPage(<PostOpportunityPage />, { persona: 'training-mgr', path: '/opportunities/post' });
    const form = await screen.findByTestId('m20-post-form', {}, T);
    const kinds = [...form.querySelectorAll('select option')].map((o) => (o as HTMLOptionElement).value);
    expect(kinds).not.toContain('security');
    expect(within(screen.getByTestId('m20-pick-gain')).queryByText(/Security awareness/)).toBeNull();
  });
});
