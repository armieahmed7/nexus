// @vitest-environment jsdom
/**
 * F24 pages (W3 · E5): the opt-out reaches the surfaces (acceptance: "Opting out of Coach removes ranked cards; the page shows
 * the unranked catalogue instead", and the same for the Navigator and the marketplace), the /my/settings card, and
 * /admin/ai-transparency for admin, AI governance, auditor and HR. Real providers, in-memory LocalBackend (g1-harness).
 */
import { describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 90000 }); // FS wave C QA: seed boot about 27 s
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import MyCoachPage from '../../src/modules/m19/MyCoachPage';
import MyCareerPage from '../../src/modules/m18/MyCareerPage';
import MarketplacePage from '../../src/modules/m20/MarketplacePage';
import MySettingsPage from '../../src/modules/m14/MySettingsPage';
import AiTransparencyPage from '../../src/modules/m16/AiTransparencyPage';

const W = { timeout: 15000 };
const optOut = (person: string, surface: string) => (b: ReturnType<typeof getLocalBackend>) => {
  b.rawInsert('reco_optouts', { id: `ro:${person}:${surface}`, person_id: person, surface, opted_out: true, reason: null, created_at: '2026-10-01T08:00:00Z', updated_at: '2026-10-01T08:00:00Z' } as never);
};

describe('F24 acceptance: opting out of the Coach removes ranked cards and shows the unranked catalogue', () => {
  it('without an opt-out, k-ro sees the ranked feed', async () => {
    await renderPage(<MyCoachPage />, { persona: 'k-ro', path: '/my/coach' });
    expect(await screen.findByTestId('m19-feed', {}, W)).toBeTruthy();
    expect(screen.queryByTestId('m16-unranked-catalogue')).toBeNull();
  });
  it('with an opt-out, no ranked card, no "Why this?", and the catalogue in plain order', async () => {
    await renderPage(<MyCoachPage />, { persona: 'k-ro', path: '/my/coach', prepare: optOut('p-k-ro', 'coach') });
    const list = await screen.findByTestId('m16-unranked-catalogue', {}, W);
    expect(screen.getByTestId('m16-opted-out').getAttribute('data-surface')).toBe('coach');
    expect(screen.queryByTestId('m19-feed')).toBeNull();
    expect(screen.queryAllByTestId('m19-card')).toHaveLength(0);
    expect(screen.queryAllByTestId('why-this')).toHaveLength(0);
    const codes = within(list).getAllByRole('listitem').map((li) => li.querySelector('.font-mono')!.textContent!);
    expect(codes.length).toBeGreaterThan(10);
    expect(codes).toEqual([...codes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    fireEvent.change(screen.getByTestId('m16-unranked-filter'), { target: { value: codes[0] } });
    await waitFor(() => expect(within(screen.getByTestId('m16-unranked-catalogue')).getAllByRole('listitem').length).toBeLessThan(codes.length));
  });
});

describe('F24: the opt-out also reaches the Career Navigator and the marketplace', () => {
  it('Navigator: roles by family, no readiness ranking', async () => {
    await renderPage(<MyCareerPage />, { persona: 'k-ro', path: '/my/career', prepare: optOut('p-k-ro', 'navigator') });
    expect(await screen.findByTestId('m16-unranked-roles', {}, W)).toBeTruthy();
    expect(screen.queryByTestId('m18-moves')).toBeNull();
    expect(screen.queryAllByTestId('why-this')).toHaveLength(0);
  });
  it('Marketplace: no match scores or top picks, opportunities by start date', async () => {
    await renderPage(<MarketplacePage />, { persona: 'k-ro', path: '/opportunities', prepare: optOut('p-k-ro', 'marketplace') });
    const list = await screen.findByTestId('m20-list', {}, W);
    expect(screen.getByTestId('m16-opted-out').getAttribute('data-surface')).toBe('marketplace');
    expect(screen.queryAllByTestId('m20-why')).toHaveLength(0);
    expect(within(list).getAllByTestId('m20-card').length).toBeGreaterThan(0);
  });
});

describe('F24 /my/settings: recommendations and your data', () => {
  it('k-ro switches the Coach off (confirmed RPC) and the row is stored', async () => {
    await renderPage(<MySettingsPage />, { persona: 'k-ro', path: '/my/settings' });
    const card = await screen.findByTestId('m16-reco-card', {}, W);
    for (const s of ['navigator', 'coach', 'marketplace']) expect(within(card).getByTestId(`m16-reco-${s}`)).toBeTruthy();
    const btn = await within(card).findByTestId('m16-optout-coach');
    expect(btn.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(btn);
    fireEvent.change(await screen.findByTestId('m16-optout-reason'), { target: { value: 'Testing the switch' } });
    fireEvent.click(screen.getByTestId('confirm-action'));
    await waitFor(() => expect(getLocalBackend().rawGet('reco_optouts', 'ro:p-k-ro:coach')?.opted_out).toBe(true), W);
    await waitFor(() => expect(screen.getByTestId('m16-optout-coach').getAttribute('aria-checked')).toBe('false'), W);
  });
  it('"How this works" opens the engine card with the inputs it never uses', async () => {
    await renderPage(<MySettingsPage />, { persona: 'k-ro', path: '/my/settings' });
    fireEvent.click(await screen.findByTestId('m16-how-navigator', {}, W));
    const c = await screen.findByTestId('m16-engine-card', {}, W);
    expect(within(c).getByTestId('m16-card-excluded').textContent).toMatch(/Gender.*Nationality.*Age/);
  });
  it('a correction request is a data_requests correction tagged as an AI inference', async () => {
    await renderPage(<MySettingsPage />, { persona: 'k-ro', path: '/my/settings' });
    fireEvent.click(await screen.findByTestId('m16-correction', {}, W));
    const box = await screen.findByLabelText(/What is wrong/);
    fireEvent.change(box, { target: { value: 'My valve maintenance level should be 3, I completed the course in May.' } });
    fireEvent.click(screen.getByTestId('m16-correction-send'));
    await waitFor(() => expect(getLocalBackend().raw('data_requests').some((r) => r.person_id === 'p-k-ro' && r.kind === 'correction' && (r.note ?? '').startsWith('[AI · '))).toBe(true), W);
  });
  it('people without a skills profile (auditor) do not get the card', async () => {
    await renderPage(<MySettingsPage />, { persona: 'k-auditor', path: '/my/settings' });
    await screen.findByTestId('m14-settings-display', {}, W);
    expect(screen.queryByTestId('m16-reco-card')).toBeNull();
  });
});

describe('F24 /admin/ai-transparency', () => {
  it('admin: eight engine cards, the flagged comparison this week, the change log and the run button', async () => {
    await renderPage(<AiTransparencyPage />, { persona: 'k-admin', path: '/admin/ai-transparency' });
    const cards = await screen.findByTestId('m16-engine-cards', {}, W);
    expect(within(cards).getAllByTestId('m16-engine-card')).toHaveLength(8);
    for (const c of within(cards).getAllByTestId('m16-engine-card')) expect(within(c).getByTestId('m16-card-excluded').querySelectorAll('li')).toHaveLength(3);
    fireEvent.click(screen.getByRole('tab', { name: /Fairness monitor/ }));
    const comps = await screen.findByTestId('m16-fair-comparisons', {}, W);
    const flagged = within(comps).getAllByTestId('m16-fair-comparison').filter((x) => x.getAttribute('data-flagged') === 'true');
    expect(flagged.map((x) => `${x.getAttribute('data-metric')}:${x.getAttribute('data-dimension')}`)).toEqual(['opportunity_selected:gender', 'hipo_pool:gender', 'hipo_pool:nationality']); // W3 integration: F18 placements now feed the HiPo pool metric
    expect(within(comps).getAllByTestId('m16-fair-suppressed').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m16-fair-run')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Change log/ })).toBeTruthy();
  });
  it('AI governance changes the match weights with a rationale; the change log shows it with audit and ledger numbers', async () => {
    await renderPage(<AiTransparencyPage />, { persona: 'ai-governance', path: '/admin/ai-transparency' });
    fireEvent.click(await screen.findByRole('tab', { name: /Change log/ }, W));
    fireEvent.click(await screen.findByTestId('m16-change-weights', {}, W));
    fireEvent.change(await screen.findByTestId('m16-weight-development'), { target: { value: '0.3' } });
    fireEvent.change(screen.getByTestId('m16-weights-rationale'), { target: { value: 'Pilot feedback: development value matters more' } });
    fireEvent.click(screen.getByTestId('m16-weights-save'));
    fireEvent.click(await screen.findByTestId('confirm-action'));
    await waitFor(() => expect(getLocalBackend().rawGet('engine_changes', 'ec:match:002')).toBeTruthy(), W);
    const ch = getLocalBackend().rawGet('engine_changes', 'ec:match:002')!;
    expect(ch.audit_seq).not.toBeNull();
    expect(ch.ledger_seq).not.toBeNull();
    await waitFor(() => expect(within(screen.getByTestId('m16-change-log')).getByText(/Pilot feedback/)).toBeTruthy(), W);
  });
  it('HR sees cards and fairness, never the change log; the auditor reads all without the run button', async () => {
    await renderPage(<AiTransparencyPage />, { persona: 'chco', path: '/admin/ai-transparency' });
    await screen.findByTestId('m16-engine-cards', {}, W);
    expect(screen.queryByRole('tab', { name: /Change log/ })).toBeNull();
    await renderPage(<AiTransparencyPage />, { persona: 'k-auditor', path: '/admin/ai-transparency' });
    fireEvent.click(await screen.findByRole('tab', { name: /Fairness monitor/ }, W));
    await screen.findByTestId('m16-fair-comparisons', {}, W);
    expect(screen.queryByTestId('m16-fair-run')).toBeNull();
    expect(screen.getByRole('tab', { name: /Change log/ })).toBeTruthy();
  });
  it('renders in Arabic', async () => {
    await renderPage(<AiTransparencyPage />, { persona: 'k-admin', path: '/ar/admin/ai-transparency' });
    await screen.findByTestId('m16-engine-cards', {}, W);
    expect(document.body.textContent).toMatch(/مستكشف المسار المهني/);
  });
});
