// @vitest-environment jsdom
/** G1 page components rendered with testing-library (local backend, real providers). */
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import CareersPage from '../../src/modules/m01/CareersPage';
import CareersRolePage from '../../src/modules/m01/CareersRolePage';
import CareersPathsPage from '../../src/modules/m01/CareersPathsPage';
import MyQualsPage from '../../src/modules/m02/MyQualsPage';
import TeamQualsPage from '../../src/modules/m02/TeamQualsPage';
import TrainingQualsStandardPage from '../../src/modules/m02/TrainingQualsStandardPage';
import VerifyPage from '../../src/modules/m02/VerifyPage';
import { fireEvent } from '@testing-library/react';
import MyLicencePage from '../../src/modules/m03/MyLicencePage';
import LicensingPage from '../../src/modules/m03/LicensingPage';
import LicensingValidityPage from '../../src/modules/m03/LicensingValidityPage';
import TeamPage from '../../src/modules/m02/TeamPage';

describe('M01 pages', () => {
  it('the Career Map lists all 28 roles, each with a basis badge', async () => {
    await renderPage(<CareersPage />, { path: '/careers' });
    const list = await screen.findByTestId('m01-role-list', {}, { timeout: 5000 });
    expect(within(list).getAllByRole('listitem')).toHaveLength(28);
    expect(within(list).getAllByTestId('role-badges')).toHaveLength(28);
  });
  it('the RO page shows three REG-17 Art. 4 entry routes', async () => {
    await renderPage(<CareersRolePage />, { path: '/careers/roles/reactor-operator', route: '/careers/roles/:slug' });
    const routes = await screen.findByTestId('m01-entry-routes', {}, { timeout: 5000 });
    const items = within(routes).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    items.forEach((li) => expect(li.textContent).toMatch(/FANR-REG-17 Art\. 4/));
  });
  it('the SRO page shows three entry routes with an article reference', async () => {
    await renderPage(<CareersRolePage />, { path: '/careers/roles/senior-reactor-operator', route: '/careers/roles/:slug' });
    const routes = await screen.findByTestId('m01-entry-routes', {}, { timeout: 5000 });
    expect(within(routes).getAllByRole('listitem')).toHaveLength(3);
    expect(within(routes).getAllByText(/Art\. 4/).length).toBe(3);
  });
  it('an unknown role shows a not-found state instead of crashing', async () => {
    await renderPage(<CareersRolePage />, { path: '/careers/roles/nope', route: '/careers/roles/:slug' });
    expect(await screen.findByText('Role not found', {}, { timeout: 5000 })).toBeTruthy();
  });
  it('the ladder shows LO -> RO -> SRO -> Shift Supervisor with conditions', async () => {
    await renderPage(<CareersPathsPage />, { path: '/careers/paths' });
    const ladder = await screen.findByTestId('career-ladder', {}, { timeout: 5000 });
    const steps = within(ladder).getAllByRole('listitem', { name: undefined }).filter((li) => li.parentElement === ladder);
    expect(steps).toHaveLength(4);
    expect(ladder.textContent).toMatch(/Local Operator[\s\S]*Reactor Operator[\s\S]*Senior Reactor Operator[\s\S]*Shift Supervisor/);
    expect(ladder.textContent).toMatch(/36 months as a fully qualified LO/);
    await waitFor(() => expect(ladder.textContent).toMatch(/24 months as RO at Barakah/));
  });
});

describe('M02 pages', () => {
  it('a qualification card shows each task with status, evaluator role, date and expiry', async () => {
    await renderPage(<MyQualsPage />, { persona: 'k-ro', path: '/my/quals' });
    const cards = await screen.findByTestId('m02-my-cards', {}, { timeout: 5000 });
    const table = within(cards).getAllByTestId('m02-task-table')[0];
    const head = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(head).toEqual(expect.arrayContaining(['Task', 'Status', 'Evaluator role', 'Date', 'Expiry']));
    expect(within(table).getAllByText('Passed').length).toBeGreaterThan(0);
    expect(cards.textContent).toMatch(/As recorded in Training records system/);
  });
  it('the qualification card renders in Arabic', async () => {
    await renderPage(<MyQualsPage />, { persona: 'k-ro', path: '/ar/my/quals' });
    const cards = await screen.findByTestId('m02-my-cards', {}, { timeout: 5000 });
    const head = within(within(cards).getAllByTestId('m02-task-table')[0]).getAllByRole('columnheader').map((h) => h.textContent);
    expect(head).toEqual(expect.arrayContaining(['المهمة', 'الحالة', 'دور المقيّم', 'التاريخ', 'الانتهاء']));
  });
  it('the team matrix shows a qualification within 30 days of expiry as due', async () => {
    await renderPage(<TeamQualsPage />, { persona: 'sro', path: '/team/quals' });
    const m = await screen.findByTestId('m02-matrix', {}, { timeout: 5000 });
    expect(m.querySelectorAll('[data-status="due"]').length).toBeGreaterThan(0);
  });
  it('the standard page lists records and tasks for an evaluator', async () => {
    await renderPage(<TrainingQualsStandardPage />, { persona: 'k-instructor', path: '/training/quals/qs-lo-turbine?tab=records', route: '/training/quals/:standard' });
    const recs = await screen.findByTestId('m02-std-records', {}, { timeout: 5000 });
    expect(within(recs).getAllByRole('row').length).toBeGreaterThan(2);
  });
  it('certificate verification returns a result card for a known number', async () => {
    await renderPage(<VerifyPage />, { path: '/verify' });
    const input = await screen.findByLabelText(/Certificate number/);
    fireEvent.change(input, { target: { value: 'KAF-2026-000417' } });
    fireEvent.click(screen.getByTestId('m02-verify-submit'));
    const res = await screen.findByTestId('m02-verify-result', {}, { timeout: 5000 });
    expect(res.textContent).toMatch(/Not an operator licence/);
  });
});

describe('M03 pages', () => {
  it('an SRO with 6 eight-hour shifts, 1 in the SRO role and 2 scheduled sees the SRO-role warning', async () => {
    await renderPage(<MyLicencePage />, {
      persona: 'sro',
      path: '/my/licence',
      prepare: (b) => b.rawUpdate('shift_proficiency', 'sp-p-sro-2026q4', { shifts_8h: 6, shifts_12h: 0, sro_role_shifts: 1, scheduled_remaining_8h: 2, scheduled_remaining_12h: 0, scheduled_remaining_sro: 0 }),
    });
    expect(await screen.findByText('SRO-role minimum at risk', {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByText('Quarterly shift minimum at risk')).toBeNull();
  });
  it('a past medical due date shows "medical overdue" on the operator view', async () => {
    await renderPage(<MyLicencePage />, { persona: 'k-ro', path: '/my/licence', prepare: (b) => b.rawUpdate('medical_due', 'med-p-k-ro', { due_on: '2026-09-15' }) });
    const pill = await screen.findByTestId('medical-pill', {}, { timeout: 5000 });
    expect(pill.getAttribute('data-view')).toBe('overdue');
    expect(pill.textContent).toBe('Medical overdue');
  });
  it('a stale source sync never shows the certificate as valid', async () => {
    await renderPage(<MyLicencePage />, { persona: 'k-ro', path: '/my/licence', prepare: (b) => b.rawUpdate('licences', 'lic-p-k-ro', { last_synced: '2026-09-01T00:00:00Z' }) });
    const pill = await screen.findByTestId('licence-pill', {}, { timeout: 5000 });
    expect(pill.getAttribute('data-view')).toBe('stale');
    expect(pill.textContent).not.toBe('Valid');
    expect(screen.getByText('Not confirmed: the source sync is stale')).toBeTruthy();
  });
  it('the public explainer lists three RO and three SRO routes with article references', async () => {
    await renderPage(<LicensingPage />, { path: '/licensing' });
    const ro = await screen.findByTestId('m03-routes-reactor-operator', {}, { timeout: 5000 });
    const sro = screen.getByTestId('m03-routes-senior-reactor-operator');
    expect(within(ro).getAllByRole('listitem')).toHaveLength(3);
    expect(within(sro).getAllByRole('listitem')).toHaveLength(3);
    expect(within(ro).getAllByText(/Art\. 4/)).toHaveLength(3);
  });
  it('the coordinator sees the lapse task due three UAE working days after a Thursday', async () => {
    await renderPage(<LicensingValidityPage />, { persona: 'k-licensing-coord', path: '/licensing/validity' });
    fireEvent.click(await screen.findByRole('tab', { name: /Tasks/ }, { timeout: 5000 }));
    const tasks = await screen.findByTestId('m03-tasks');
    const row = within(tasks).getByText('Report validity lapse within 3 working days').closest('tr')!;
    expect(row.textContent).toMatch(/13 Oct 2026/);
  });
  it('a shift supervisor sees crew availability but no medical dates or flags', async () => {
    await renderPage(<TeamPage />, { persona: 'sro', path: '/team' });
    const crew = await screen.findByTestId('m02-crew-licences', {}, { timeout: 5000 });
    expect(crew.textContent).toMatch(/Available|Not available/);
    expect(crew.textContent).not.toMatch(/Fit for duty|Medical overdue|Not yet confirmed/);
  });
});
