// @vitest-environment jsdom
/** FS64 / FS65 pages (FS wave G · E3, M36) rendered with the real providers and the in-memory LocalBackend: the regional plan for a
 *  partner (released aggregates, own coverage) and for staff (no commitments); provider commitments for a partner (own rows only) and for
 *  HR (all providers, coverage); a commitment's delivery status, a delivery report through the RPC and the cross-organisation not-found;
 *  the HR director's release flow; the pledges ledger with three separate tiles and suppressed cells; our pledges with a progress drawer;
 *  Arabic. Every page shows its benchmark chips. */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import seed from '../../src/seed/seed.json';
import ar from '../../src/i18n/m36.ar.json';
import en from '../../src/i18n/m36.en.json';
import RegionalPlanPage from '../../src/modules/m36/RegionalPlanPage';
import CommitmentsPage from '../../src/modules/m36/CommitmentsPage';
import CommitmentPage from '../../src/modules/m36/CommitmentPage';
import DemandReleasePage from '../../src/modules/m36/DemandReleasePage';
import PledgesPage from '../../src/modules/m36/PledgesPage';
import PledgeRegisterPage from '../../src/modules/m36/PledgeRegisterPage';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const W = { timeout: 30000 };
const chips = () => Array.from(document.querySelectorAll('button[data-testid^="benchmark-chip-"]')).map((x) => x.getAttribute('data-testid'));
const links = (id: string) => screen.getAllByTestId(id).map((a) => a.getAttribute('href') ?? '');

describe('FS64 pages', () => {
  it('partner admin: released demand per area and year (SIMULATED), own coverage of the 2030 gap, FS64 chips', async () => {
    await renderPage(<RegionalPlanPage />, { persona: 'alnoor-gm', path: '/ecosystem/regional-plan' });
    const rp = await screen.findByTestId('m36-rp', {}, { timeout: 90000 });
    expect(rp.getAttribute('data-release')).toBe('rdr-2025-1');
    expect(within(rp).getByTestId('m36-demo-labels')).toBeTruthy();
    const table = within(rp).getByTestId('m36-demand-table');
    expect(table.getAttribute('data-year')).toBe('2030');
    await waitFor(() => expect(within(table).getAllByTestId('m36-gap-plan').length).toBe(T.regional_demand.filter((r) => r.year === 2030).length), W);
    const cov = within(rp).getByTestId('m36-rp-coverage');
    const maint = within(cov).getAllByTestId('m36-cov-row').find((r) => r.getAttribute('data-area') === 'maintenance')!;
    expect(maint.getAttribute('data-pct')).not.toBe('');
    expect(screen.getByTestId('m36-rp-to-commitments')).toBeTruthy();
    await waitFor(() => expect(chips()).toEqual(expect.arrayContaining(['benchmark-chip-FORECAST', 'benchmark-chip-EU-PACT'])), W);
  }, 150000);
  it('staff: the released demand only (no commitments, no coverage, no release action)', async () => {
    await renderPage(<RegionalPlanPage />, { persona: 'nse', path: '/ecosystem/regional-plan' });
    await screen.findByTestId('m36-rp', {}, { timeout: 90000 });
    expect(screen.queryByTestId('m36-rp-coverage')).toBeNull();
    expect(screen.queryByTestId('m36-rp-to-commitments')).toBeNull();
    expect(screen.queryByTestId('m36-rp-to-release')).toBeNull();
  }, 120000);
  it('partner isolation on the commitments page: gulfhydro-qa lists only its own commitments, each with a delivery status', async () => {
    await renderPage(<CommitmentsPage />, { persona: 'gulfhydro-qa', path: '/ecosystem/regional-plan/commitments' });
    await screen.findByTestId('m36-cm', {}, { timeout: 90000 });
    const hrefs = links('m36-commitment-link');
    expect(hrefs.length).toBe(T.provider_commitments.filter((c) => c.org_id === 'org-gulfhydro').length);
    expect(hrefs.every((h) => h.includes('pc-org-gulfhydro-'))).toBe(true);
    expect(screen.getAllByTestId('m36-commit-status').length).toBe(hrefs.length);
    expect(screen.getByTestId('m36-commit-open')).toBeTruthy();
    expect(screen.queryByTestId('m36-cm-coverage')).toBeNull();
  }, 120000);
  it('HR: every provider, the three separate totals and the coverage of each area\'s 2030 gap', async () => {
    await renderPage(<CommitmentsPage />, { persona: 'chco', path: '/ecosystem/regional-plan/commitments' });
    await screen.findByTestId('m36-cm', {}, { timeout: 90000 });
    expect(links('m36-commitment-link').length).toBe(T.provider_commitments.length);
    const statuses = screen.getAllByTestId('m36-commit-status').map((x) => x.getAttribute('data-status'));
    expect(statuses).toEqual(expect.arrayContaining(['on_track', 'at_risk', 'behind', 'withdrawn']));
    for (const id of ['m36-cm-seats', 'm36-cm-enrolled', 'm36-cm-completed']) expect(screen.getByTestId(id)).toBeTruthy();
    expect(within(screen.getByTestId('m36-cm-coverage')).getAllByTestId('m36-cov-row').length).toBe(T.regional_demand.filter((r) => r.year === 2030).length);
    expect(screen.queryByTestId('m36-commit-open')).toBeNull();
  }, 120000);
  it('a commitment: delivery status with Why this?, terms, and a delivery report through the RPC (audited)', async () => {
    const b = getLocalBackend();
    await renderPage(<CommitmentPage />, { persona: 'alnoor-gm', path: '/ecosystem/regional-plan/commitments/pc-org-alnoor-1', route: '/ecosystem/regional-plan/commitments/:id' });
    const d = await screen.findByTestId('m36-cd', {}, { timeout: 90000 });
    expect(d.getAttribute('data-id')).toBe('pc-org-alnoor-1');
    expect(within(d).getByTestId('m36-cd-status')).toBeTruthy();
    expect(within(d).getAllByTestId('m36-cd-term').length).toBe(T.provider_commitments.find((c) => c.id === 'pc-org-alnoor-1')!.plan.length);
    fireEvent.click(within(d).getByTestId('m36-cd-why'));
    expect(await screen.findByTestId('m36-cd-why-panel', {}, W)).toBeTruthy();
    const spy = vi.spyOn(b.rpc, 'reportCommitmentDelivery');
    const form = within(d).getByTestId('m36-cd-report');
    fireEvent.change(within(form).getByLabelText(en.cm.col.enrolled), { target: { value: '12' } });
    fireEvent.change(within(form).getByLabelText(en.cm.col.completed), { target: { value: '11' } });
    await waitFor(() => expect((within(form).getByTestId('m36-cd-report-submit') as HTMLButtonElement).disabled).toBe(false), W);
    fireEvent.click(within(form).getByTestId('m36-cd-report-submit'));
    await waitFor(() => expect(screen.getAllByRole('button', { name: en.cd.reportSave }).length).toBeGreaterThan(1), W);
    fireEvent.click(screen.getAllByRole('button', { name: en.cd.reportSave }).at(-1)!);
    await waitFor(() => expect(spy).toHaveBeenCalled(), W);
    expect((await spy.mock.results[0].value).ok).toBe(true);
    spy.mockRestore();
  }, 150000);
  it('another organisation\'s commitment reads as not found', async () => {
    await renderPage(<CommitmentPage />, { persona: 'gulfhydro-qa', path: '/ecosystem/regional-plan/commitments/pc-org-alnoor-1', route: '/ecosystem/regional-plan/commitments/:id' });
    expect(await screen.findByText(en.cd.notFound, {}, { timeout: 90000 })).toBeTruthy();
  }, 120000);
  it('HR director: the newer released forecast is pending; preview rows; the release goes through the RPC', async () => {
    const b = getLocalBackend();
    await renderPage(<DemandReleasePage />, { persona: 'chco', path: '/ecosystem/regional-plan/release' });
    const rel = await screen.findByTestId('m36-rel', {}, { timeout: 90000 });
    expect(within(rel).getByTestId('m36-rel-pending')).toBeTruthy();
    expect(within(rel).getAllByTestId('m36-rel-row').length).toBeGreaterThan(5);
    const spy = vi.spyOn(b.rpc, 'releaseRegionalDemand');
    fireEvent.change(within(rel).getByLabelText(en.rel.noteEn), { target: { value: 'The 2026 annual refresh for the next intake.' } });
    fireEvent.change(within(rel).getByLabelText(en.rel.noteAr), { target: { value: 'التحديث السنوي لعام 2026 للدفعة القادمة.' } });
    await waitFor(() => expect((within(rel).getByTestId('m36-rel-submit') as HTMLButtonElement).disabled).toBe(false), W);
    fireEvent.click(within(rel).getByTestId('m36-rel-submit'));
    const btns = await screen.findAllByRole('button', { name: en.rel.release }, W);
    fireEvent.click(btns.at(-1)!);
    await waitFor(() => expect(spy).toHaveBeenCalled(), W);
    expect((await spy.mock.results[0].value).data).toMatchObject({ release_id: 'rdr-2026-1' });
    spy.mockRestore();
  }, 150000);
  it('renders in Arabic', async () => {
    await renderPage(<RegionalPlanPage />, { persona: 'alnoor-gm', path: '/ar/ecosystem/regional-plan' });
    await screen.findByTestId('m36-rp', {}, { timeout: 90000 });
    expect(screen.getByText(ar.routes['ecosystem-regional-plan'].title, { selector: 'h1' })).toBeTruthy();
  }, 120000);
});

describe('FS65 pages', () => {
  it('staff: three separate tiles (pledged, started, completed), suppressed cells, FS65 chips', async () => {
    await renderPage(<PledgesPage />, { persona: 'nse', path: '/ecosystem/pledges' });
    const pl = await screen.findByTestId('m36-pl', {}, { timeout: 90000 });
    const tiles = within(pl).getByTestId('m36-pl-tiles');
    for (const id of ['m36-tile-pledged', 'm36-tile-started', 'm36-tile-completed']) expect(within(tiles).getByTestId(id)).toBeTruthy();
    expect(within(tiles).queryByText(/total/i)).toBeNull();
    const area = within(pl).getByTestId('m36-pl-by-area');
    expect(within(area).getAllByTestId('m36-pl-row').length).toBeGreaterThan(5);
    expect(area.querySelectorAll('[data-suppressed="true"]').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('m36-pl-to-register')).toBeNull();
    await waitFor(() => expect(chips()).toEqual(expect.arrayContaining(['benchmark-chip-EU-PACT', 'benchmark-chip-ENERGY-JOBS'])), W);
  }, 150000);
  it('partner admin: our pledges only, each with organisation, area and date; the drawer records progress through the RPC', async () => {
    const b = getLocalBackend();
    await renderPage(<PledgeRegisterPage />, { persona: 'alnoor-gm', path: '/ecosystem/pledges/register' });
    const pr = await screen.findByTestId('m36-pr', {}, { timeout: 90000 });
    const opens = within(pr).getAllByTestId('m36-pr-open-pledge');
    expect(opens.length).toBe(T.pledges.filter((p) => p.org_id === 'org-alnoor').length);
    expect(within(pr).getAllByTestId('m36-pr-pledged').length).toBe(opens.length);
    fireEvent.click(opens[0]);
    const dr = await screen.findByTestId('m36-pr-drawer', {}, W);
    expect(within(dr).getByTestId('m36-pr-three')).toBeTruthy();
    const rec = within(dr).getByTestId('m36-pr-record');
    const spy = vi.spyOn(b.rpc, 'recordPledgeProgress');
    const pid = dr.getAttribute('data-id')!;
    const last = T.pledge_progress.filter((x) => x.pledge_id === pid).sort((a, c) => (a.as_of < c.as_of ? 1 : -1))[0];
    fireEvent.change(within(rec).getByLabelText(en.pl.started), { target: { value: String((last?.started ?? 0) + 2) } });
    fireEvent.change(within(rec).getByLabelText(en.pl.completed), { target: { value: String((last?.completed ?? 0) + 1) } });
    await waitFor(() => expect((within(rec).getByTestId('m36-pr-record-submit') as HTMLButtonElement).disabled).toBe(false), W);
    fireEvent.click(within(rec).getByTestId('m36-pr-record-submit'));
    const btns = await screen.findAllByRole('button', { name: en.pr.recordSave }, W);
    fireEvent.click(btns.at(-1)!);
    await waitFor(() => expect(spy).toHaveBeenCalled(), W);
    expect((await spy.mock.results[0].value).ok).toBe(true);
    spy.mockRestore();
  }, 150000);
});
