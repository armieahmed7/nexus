// @vitest-environment jsdom
/** FS46-FS48 pages rendered with the real providers and the in-memory LocalBackend: the behaviour catalogue (anchors at five points,
 *  coach cards with "Why this?") in EN and AR, the 360 on both form versions, the programme heatmap, the Future Leaders track and its
 *  desk, and the women-in-future-nuclear network and its programme view. Every page shows its FS benchmark chips. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import LeadershipBehavioursPage from '../../src/modules/m22/LeadershipBehavioursPage';
import Leadership360Page from '../../src/modules/m22/Leadership360Page';
import LeadershipInsightsPage from '../../src/modules/m22/LeadershipInsightsPage';
import FutureLeadersPage from '../../src/modules/m22/FutureLeadersPage';
import FutureLeadersManagePage from '../../src/modules/m22/FutureLeadersManagePage';
import WomenInNuclearPage from '../../src/modules/m22/WomenInNuclearPage';
import WomenInNuclearProgrammePage from '../../src/modules/m22/WomenInNuclearProgrammePage';

const T = { timeout: 30000 };
const chips = async (ids: string[]) => { for (const id of ids) await waitFor(() => expect(screen.getAllByTestId(`benchmark-chip-${id}`).length).toBeGreaterThan(0), T); };

describe('FS46 pages', () => {
  it('the behaviour catalogue: 12 behaviours with anchors at five points, coach cards ranked with "Why this?", FS46 chips', async () => {
    await renderPage(<LeadershipBehavioursPage />, { persona: 'qc-inspector', path: '/leadership/behaviours' });
    await waitFor(() => expect(screen.getAllByTestId('m22-beh-card').length).toBe(12), { timeout: 90000 });
    for (const t of screen.getAllByTestId('m22-beh-anchors')) expect(t.querySelectorAll('tbody tr').length).toBe(5);
    await waitFor(() => expect(screen.getAllByTestId('m22-coach-card').length).toBe(4), T);
    expect(screen.getAllByTestId('m22-why-coach').length).toBe(4);
    fireEvent.click(screen.getByTestId('m22-beh-filter-future'));
    expect(screen.getAllByTestId('m22-beh-card').map((x) => x.getAttribute('data-behaviour'))).toEqual(['b-digital-change', 'b-ai-teams', 'b-intrapreneurship', 'b-inclusion']);
    await chips(['GREENCOMP', 'WEF-FOJ', 'NEA']);
  }, 150000);
  it('renders in Arabic with Arabic anchors', async () => {
    await renderPage(<LeadershipBehavioursPage />, { persona: 'qc-inspector', path: '/ar/leadership/behaviours' });
    await waitFor(() => expect(screen.getAllByTestId('m22-beh-card').length).toBe(12), T);
    const first = screen.getAllByTestId('m22-beh-anchors')[0];
    expect(/[؀-ۿ]/.test(first.textContent ?? '')).toBe(true);
    expect(document.body.textContent).toContain('السلوكيات المستقبلية');
  }, 60000);
  it('the 360: a form-2 cycle shows twelve behaviours, the older form-1 cycle stays readable with eight', async () => {
    await renderPage(<Leadership360Page />, { persona: 'qc-inspector', path: '/leadership/360' });
    await waitFor(() => expect(screen.getByTestId('m22-360-results').querySelectorAll(':scope > li').length).toBe(12), T);
    expect(screen.getByTestId('m22-360-form-version').textContent).toMatch(/2/);
    fireEvent.click(screen.getByRole('button', { name: '2026-H1' }));
    await waitFor(() => expect(screen.getByTestId('m22-360-results').querySelectorAll(':scope > li').length).toBe(8), T);
    expect(screen.getByTestId('m22-360-v1-note')).toBeTruthy();
    await chips(['GREENCOMP']);
  }, 60000);
  it('the HR insights: the form-2 programme heatmap next to the form-1 grade view', async () => {
    await renderPage(<LeadershipInsightsPage />, { persona: 'chco', path: '/leadership/insights' });
    expect(await screen.findByTestId('m22-insights-programmes', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m22-insights-heatmap')).toBeTruthy();
    await chips(['NEA']);
  }, 60000);
});

describe('FS47 pages', () => {
  it('the Future Leaders track: five competencies with four descriptors and a route, cohorts, seven external programmes with sources, my project', async () => {
    await renderPage(<FutureLeadersPage />, { persona: 'qc-inspector', path: '/leadership/future-leaders' });
    await waitFor(() => expect(screen.getAllByTestId('m22-fl-comp').length).toBe(5), T);
    for (const c of screen.getAllByTestId('m22-fl-comp')) {
      expect(within(c).getByTestId('m22-fl-descriptors').querySelectorAll('tr').length).toBe(4);
      expect(within(c).getByTestId('m22-fl-route').querySelectorAll('li').length).toBeGreaterThanOrEqual(2);
    }
    expect(screen.getAllByTestId('m22-fl-ext').length).toBe(7);
    for (const x of screen.getAllByTestId('m22-fl-ext')) expect(x.querySelector('a[href^="https://"]')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('m22-fl-readiness')).toBeTruthy(), T);
    expect(screen.getByTestId('m22-why-fl')).toBeTruthy();
    expect(screen.getByTestId('m22-fl-project')).toBeTruthy();
    expect(screen.getByTestId('m22-fl-my-modules').querySelectorAll('li').length).toBe(6);
    await chips(['NUC-NET', 'NEA']);
  }, 60000);
  it('the desk (HR director): nominations with the nominate button, roster, readiness and suppressed statistics', async () => {
    await renderPage(<FutureLeadersManagePage />, { persona: 'chco', path: '/leadership/future-leaders/manage' });
    await waitFor(() => expect(screen.getAllByTestId('m22-fl-nom').length).toBe(25), T);
    expect(screen.getByTestId('m22-fl-nominate')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Statistics/ }));
    expect(await screen.findByTestId('m22-fl-stats', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m22-fl-stats').textContent).toContain('<10');
    await chips(['NUC-NET']);
  }, 60000);
  it('renders the track in Arabic', async () => {
    await renderPage(<FutureLeadersPage />, { persona: 'qc-inspector', path: '/ar/leadership/future-leaders' });
    await waitFor(() => expect(screen.getAllByTestId('m22-fl-comp').length).toBe(5), T);
    expect(document.body.textContent).toContain('نموذج الكفاءات');
  }, 60000);
});

describe('FS48 pages', () => {
  it('the network (opted-in participant): three strands, my choices, ranked circles and offers with "Why this?", my requests', async () => {
    await renderPage(<WomenInNuclearPage />, { persona: 'qc-inspector', path: '/communities/women-in-nuclear' });
    expect(await screen.findByTestId('m22-wfn-strands', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m22-wfn-strands').children.length).toBe(3);
    await waitFor(() => expect(screen.getAllByTestId('m22-wfn-circle').length).toBeGreaterThan(2), T);
    expect(screen.getAllByTestId('m22-why-circle').length).toBe(screen.getAllByTestId('m22-wfn-circle').length);
    expect(screen.getAllByTestId('m22-wfn-offer').length).toBeGreaterThan(1);
    expect(screen.getByTestId('m22-wfn-withdraw')).toBeTruthy();
    expect(screen.getByTestId('m22-wfn-my-requests')).toBeTruthy();
    await chips(['NUC-NET', 'ENERGY-JOBS']);
  }, 60000);
  it('not opted in (k-ro): only the opt-in form, no rankings', async () => {
    await renderPage(<WomenInNuclearPage />, { persona: 'k-ro', path: '/communities/women-in-nuclear' });
    expect(await screen.findByTestId('m22-wfn-optin', {}, T)).toBeTruthy();
    expect(screen.queryByTestId('m22-wfn-circles')).toBeNull();
    expect(screen.queryByTestId('m22-wfn-withdraw')).toBeNull();
  }, 60000);
  it('the programme view: HR sees aggregates with suppression and no desk; the training manager also gets the desk', async () => {
    await renderPage(<WomenInNuclearProgrammePage />, { persona: 'chco', path: '/communities/women-in-nuclear/programme' });
    expect(await screen.findByTestId('m22-wfn-stats', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m22-wfn-pipeline').textContent).toContain('<10');
    expect(screen.queryByRole('tab', { name: /Request desk/ })).toBeNull();
    await chips(['ENERGY-JOBS']);
  }, 60000);
  it('the programme view in Arabic for the training manager, with the request desk', async () => {
    await renderPage(<WomenInNuclearProgrammePage />, { persona: 'training-mgr', path: '/ar/communities/women-in-nuclear/programme' });
    expect(await screen.findByTestId('m22-wfn-stats', {}, T)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'مكتب الطلبات' }));
    expect(await screen.findByTestId('m22-wfn-desk', {}, T)).toBeTruthy();
    expect(document.body.textContent).toContain('مؤشرات المسار');
  }, 60000);
});
