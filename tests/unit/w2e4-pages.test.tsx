// @vitest-environment jsdom
/** F15 pages rendered with the real providers and the in-memory LocalBackend: the hub ranks programmes with reasons (EN and AR),
 *  my rotation with check-in, the host desk (maker-checker routing and shadow consent), the shadowing directory, the suppressed
 *  HR board, the programme detail with its sourced duration, and the design page for programme owners. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import RotationsPage from '../../src/modules/m20/RotationsPage';
import MyRotationPage from '../../src/modules/m20/MyRotationPage';
import HostDeskPage from '../../src/modules/m20/HostDeskPage';
import ShadowPage from '../../src/modules/m20/ShadowPage';
import RotationBoardPage from '../../src/modules/m20/RotationBoardPage';
import RotationTemplatePage from '../../src/modules/m20/RotationTemplatePage';
import ProgrammeDesignPage from '../../src/modules/m20/ProgrammeDesignPage';

const T = { timeout: 8000 };

describe('F15 pages', { timeout: 90000 }, () => { // FS wave C QA: seed boot about 27 s
  it('the hub ranks programmes with a "Why this?" on every card and shows the current rotation (k-ro)', async () => {
    await renderPage(<RotationsPage />, { persona: 'k-ro', path: '/opportunities/rotations' });
    const list = await screen.findByTestId('m20-rot-programmes', {}, T);
    const cards = within(list).getAllByTestId('m20-rot-programme');
    expect(cards.length).toBe(8); // FS wave D QA: + 3 published FS28 future-role templates (rt-fs-*)
    expect(within(list).getAllByTestId('m20-rot-why')).toHaveLength(cards.length);
    fireEvent.click(within(list).getAllByTestId('m20-rot-why')[0]);
    expect((await screen.findAllByTestId('m20-rot-why-panel'))[0].textContent).toMatch(/objectives would grow|already meet/);
    expect(screen.getByTestId('m20-rot-current').textContent).toMatch(/Plant engineering/);
    expect(screen.getAllByTestId('m20-rot-host').length).toBeGreaterThan(0);
  });
  it('renders in Arabic with Arabic reasons', async () => {
    await renderPage(<RotationsPage />, { persona: 'k-ro', path: '/ar/opportunities/rotations' });
    const list = await screen.findByTestId('m20-rot-programmes', {}, T);
    fireEvent.click(within(list).getAllByTestId('m20-rot-why')[0]);
    expect((await screen.findAllByTestId('m20-rot-why-panel'))[0].textContent).toMatch(/[؀-ۿ]/);
  });
  it('my rotation shows the plan with objectives and records a mid-point check-in through the dialog', async () => {
    await renderPage(<MyRotationPage />, { persona: 'k-ro', path: '/opportunities/rotations/my' });
    const plan = await screen.findByTestId('m20-rot-plan', {}, T);
    expect(within(plan).getAllByTestId('m20-rot-placement')).toHaveLength(2);
    expect(within(plan).getAllByTestId('m20-site-induction').length).toBeGreaterThan(0);
    fireEvent.click(within(plan).getByTestId('m20-rot-checkin'));
    fireEvent.change(await screen.findByTestId('m20-rot-checkin-note'), { target: { value: 'Settled in; rounds on track.' } });
    fireEvent.click(screen.getByTestId('m20-rot-checkin-confirm'));
    await waitFor(() => expect(screen.queryByTestId('m20-rot-checkin')).toBeNull(), T);
  });
  it("the outage manager's desk lists overdue GDP placements ready for sign-off", async () => {
    await renderPage(<HostDeskPage />, { persona: 'outage-manager', path: '/opportunities/rotations/host' });
    fireEvent.click(await screen.findByRole('tab', { name: /To sign off/ }, T));
    const list = await screen.findByTestId('m20-rot-signoffs', {}, T);
    const items = within(list).getAllByTestId('m20-rot-host-placement');
    expect(items.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(within(items[0]).getByTestId('m20-rot-signoff'));
    fireEvent.change(await screen.findByTestId('m20-rot-signoff-note'), { target: { value: 'Objectives met; strong outage support.' } });
    fireEvent.click(screen.getByTestId('m20-rot-signoff-confirm'));
    await waitFor(() => expect(screen.queryAllByTestId('m20-rot-host-placement').length).toBe(items.length - 1), { timeout: 20000 });
    expect(await screen.findByText(/Placement signed off; skills evidence recorded/, {}, T)).toBeTruthy();
  });
  it('the shift manager sees shadowing consents waiting as line manager or host', async () => {
    await renderPage(<HostDeskPage />, { persona: 'sro', path: '/opportunities/rotations/host' });
    await screen.findByRole('tab', { name: /Shadowing/ }, T);
    fireEvent.click(screen.getByRole('tab', { name: /Shadowing/ }));
    const consents = await screen.findByTestId('m20-rot-consents', {}, T);
    expect(within(consents).getAllByTestId('m20-rot-consent').length).toBeGreaterThanOrEqual(2);
  });
  it('the shadowing directory ranks hosts with reasons and opens the request form', async () => {
    await renderPage(<ShadowPage />, { persona: 'qc-inspector', path: '/opportunities/rotations/shadow' });
    const hosts = await screen.findByTestId('m20-rot-hosts', {}, T);
    expect(within(hosts).getAllByTestId('m20-rot-host-why').length).toBeGreaterThan(10);
    fireEvent.click(within(hosts).getAllByTestId('m20-rot-pick-host')[0]);
    expect(await screen.findByTestId('m20-rot-request-form')).toBeTruthy();
  });
  it('the HR board suppresses cohorts under 10 and shows no names', async () => {
    await renderPage(<RotationBoardPage />, { persona: 'k-hr-analyst', path: '/opportunities/rotations/board' });
    const grid = await screen.findByTestId('m20-rot-cohorts', {}, T);
    expect(grid.querySelectorAll('[data-suppressed="true"]').length).toBe(3);
    expect(grid.querySelectorAll('[data-suppressed="false"]').length).toBe(2);
    expect(screen.getByTestId('m20-rot-board').textContent).not.toMatch(/role card|w-lo-|p-k-ro/);
  });
  it('the GDP programme page shows the sourced 18 to 36 month duration and, for the CHCO office, the enrolment form', async () => {
    await renderPage(<RotationTemplatePage />, { persona: 'chco', path: '/opportunities/rotations/programmes/rt-gdp-engineering', route: '/opportunities/rotations/programmes/:id' });
    const dur = await screen.findByTestId('m20-rot-duration', {}, T);
    expect(dur.textContent).toMatch(/18 to 36 months/);
    expect(screen.getAllByText(/ENEC · Careers/).length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('m20-rot-steps')).getAllByTestId('m20-objectives')).toHaveLength(4);
    expect(await screen.findByTestId('m20-rot-enrol', {}, T)).toBeTruthy();
    await waitFor(() => expect(screen.getAllByTestId('m20-rot-enrol-person').length).toBeGreaterThan(0), T);
  });
  it('the design page lists programmes (with the owner draft) and never offers restricted families', async () => {
    await renderPage(<ProgrammeDesignPage />, { persona: 'chco', path: '/opportunities/rotations/design' });
    const list = await screen.findByTestId('m20-rot-design-list', {}, T);
    expect(list.textContent).toMatch(/Digital and data rotation \(draft\)/);
    fireEvent.click(screen.getByTestId('m20-rot-new-programme'));
    const editor = await screen.findByTestId('m20-rot-editor', {}, T);
    const opts = [...editor.querySelectorAll('select option')].map((o) => (o as HTMLOptionElement).value);
    expect(opts).not.toContain('security');
    expect(opts).not.toContain('cyber');
    expect(opts).not.toContain('sk-sa-01');
  });
});
