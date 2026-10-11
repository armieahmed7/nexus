// @vitest-environment jsdom
/** FS27/FS28 pages rendered with the real providers and the in-memory LocalBackend: the future-skills gig hub (EN and AR) with its
 *  channel filter and benchmark chips, asking for a time envelope, a line manager approving one, the future-role rotation templates,
 *  my secondments with the knowledge-transfer obligation, and the HR secondment desk closing a secondment (which plans the capture session). */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import FutureGigsPage from '../../src/modules/m20/FutureGigsPage';
import EnvelopePage from '../../src/modules/m20/EnvelopePage';
import TeamEnvelopesPage from '../../src/modules/m20/TeamEnvelopesPage';
import FutureRotationsPage from '../../src/modules/m20/FutureRotationsPage';
import SecondmentsPage from '../../src/modules/m20/SecondmentsPage';
import SecondmentDeskPage from '../../src/modules/m20/SecondmentDeskPage';

const T = { timeout: 60000 };

describe('FS27 pages', () => {
  it('the hub ranks the 15 open future gigs, filters by channel and shows the FS27 chips', async () => {
    await renderPage(<FutureGigsPage />, { persona: 'k-ro', path: '/opportunities/future' });
    const gigs = await screen.findAllByTestId('m20-fs-gig', {}, T);
    expect(gigs.length).toBe(15);
    expect(screen.getByTestId('m20-fs-my-envelope')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByTestId(/^benchmark-chip-/).length).toBeGreaterThan(0), T);
    fireEvent.click(screen.getByTestId('m20-fs-channel-ai_pilot'));
    await waitFor(() => expect(screen.getAllByTestId('m20-fs-gig').every((g) => g.getAttribute('data-channel') === 'ai_pilot')).toBe(true));
    expect(screen.getAllByTestId('m20-fs-gig').length).toBe(3);
  }, 150000);
  it('the hub renders in Arabic', async () => {
    await renderPage(<FutureGigsPage />, { persona: 'k-ro', path: '/ar/opportunities/future' });
    expect((await screen.findAllByTestId('m20-fs-gig', {}, T)).length).toBe(15);
    expect(/[؀-ۿ]/.test(document.body.textContent ?? '')).toBe(true);
  }, 90000);
  it('a person asks for a time envelope and sees it pending with their line manager', async () => {
    await renderPage(<EnvelopePage />, { persona: 'nse', path: '/opportunities/envelope' });
    const form = await screen.findByTestId('m20-fs-env-form', {}, T);
    const before = screen.queryAllByTestId('m20-fs-env-withdraw').length;
    fireEvent.change(within(form).getByRole('textbox'), { target: { value: 'I want to help prepare supplier data for the AI pilots this quarter.' } });
    await waitFor(() => expect((screen.getByTestId('m20-fs-env-ask') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('m20-fs-env-ask'));
    fireEvent.click(await screen.findByTestId('confirm-action'));
    await waitFor(() => expect(screen.queryAllByTestId('m20-fs-env-withdraw').length).toBe(before + 1), T);
    const mine = getLocalBackend().raw('time_envelopes').filter((e) => e.person_id === 'p-nse');
    expect(mine.some((e) => e.status === 'requested' && e.line_manager_id === 'p-cpo')).toBe(true);
  }, 90000);
  it('the line manager approves a pending envelope; the decision is recorded', async () => {
    await renderPage(<TeamEnvelopesPage />, { persona: 'ops-ceo', path: '/opportunities/envelopes' });
    fireEvent.click(await screen.findByTestId('m20-fs-approve-env-p-k-lo-trainee-2026-q4', {}, T));
    fireEvent.click(await screen.findByTestId('confirm-action'));
    await waitFor(() => expect(screen.queryByTestId('m20-fs-approve-env-p-k-lo-trainee-2026-q4')).toBeNull(), T);
    const e = getLocalBackend().raw('time_envelopes').find((x) => x.id === 'env-p-k-lo-trainee-2026-q4')!;
    expect(e.status).toBe('approved');
    expect(e.approver_id).toBe('p-ops-ceo');
  }, 90000);
});

describe('FS28 pages', () => {
  it('future-role rotations list the three published templates, each with its track', async () => {
    await renderPage(<FutureRotationsPage />, { persona: 'k-ro', path: '/opportunities/rotations/future' });
    const cards = await screen.findAllByTestId('m20-sec-template', {}, T);
    expect(cards.length).toBe(3);
    expect(cards.map((c) => c.getAttribute('data-track')).sort()).toEqual(['advance_study', 'data_office', 'digital_twin']);
    await waitFor(() => expect(screen.getAllByTestId(/^benchmark-chip-/).length).toBeGreaterThan(0), T);
  }, 90000);
  it('my secondments show host, objectives and the return obligation', async () => {
    await renderPage(<SecondmentsPage />, { persona: 'fuel-pm', path: '/opportunities/secondments' });
    const mine = await screen.findByTestId('m20-sec-mine', {}, T);
    expect(mine.querySelectorAll('li').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('m20-sec-objectives').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('m20-sec-hosts')).toBeTruthy();
  }, 90000);
  it('the HR desk closes a secondment on return, which plans the knowledge-capture session', async () => {
    await renderPage(<SecondmentDeskPage />, { persona: 'chco', path: '/opportunities/secondments/hr' });
    fireEvent.click(await screen.findByTestId('m20-sec-close-sec-fuel-vendor-01', {}, T));
    const form = await screen.findByTestId('m20-sec-close-form');
    fireEvent.change(within(form).getByRole('textbox'), { target: { value: 'Objectives met; the fuel vendor review process is now documented for the team.' } });
    await waitFor(() => expect((screen.getByTestId('m20-sec-close-save') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('m20-sec-close-save'));
    fireEvent.click(await screen.findByTestId('confirm-action'));
    await waitFor(() => expect(screen.queryByTestId('m20-sec-close-sec-fuel-vendor-01')).toBeNull(), T);
    const b = getLocalBackend();
    const sec = b.raw('secondments').find((x) => x.id === 'sec-fuel-vendor-01')!;
    expect(sec.status).toBe('returned');
    expect(b.raw('capture_sessions').some((c) => c.id === sec.capture_session_id)).toBe(true);
  }, 90000);
});
