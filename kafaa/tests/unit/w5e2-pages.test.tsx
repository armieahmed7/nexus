// @vitest-environment jsdom
/** F33 pages rendered with the real providers and the in-memory LocalBackend: the partner admin's team matrix against the contracted
 *  ENEC role profiles (own organisation only, "Why this?"), the people list, a contractor's own passport with the evidence drawer and
 *  "wrap as badge", the equivalency pre-check (likely coverage per task with reasons, read-only, submit through submitEquivalency),
 *  the ENEC evaluator's read-only view, the contracted role profiles admin page, and Arabic. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import PartnerPassportPage from '../../src/modules/m09/PartnerPassportPage';
import PartnerPassportPersonPage from '../../src/modules/m09/PartnerPassportPersonPage';
import PartnerPrecheckPage from '../../src/modules/m09/PartnerPrecheckPage';
import EquivalencyPassportPage from '../../src/modules/m09/EquivalencyPassportPage';
import AdminContractRolesPage from '../../src/modules/m09/AdminContractRolesPage';

const W = { timeout: 15000 };
const confirm = async () => fireEvent.click(await screen.findByTestId('confirm-action', {}, W));

describe('F33 pages', { timeout: 60000 }, () => {
  it('the partner admin sees the team matrix of their own organisation against a contracted profile, with reasons', async () => {
    await renderPage(<PartnerPassportPage />, { persona: 'alnoor-gm', path: '/partner/workforce/passport' });
    const matrix = await screen.findByTestId('m09-cp-matrix', {}, W);
    const rows = within(matrix).getAllByTestId('m09-cp-row');
    expect(rows.length).toBe(12);
    expect(rows.every((r) => r.getAttribute('data-person')!.startsWith('c-alnoor-'))).toBe(true);
    expect(screen.getAllByTestId('m09-cp-target').length).toBe(2);
    expect(matrix.querySelectorAll('td[data-status="met"]').length).toBeGreaterThan(0);
    fireEvent.click(within(rows[0]).getByTestId('m09-cp-row-why'));
    expect((await screen.findByTestId('m09-cp-row-why-panel')).textContent).toMatch(/Readiness for this role profile/);
    fireEvent.click(screen.getAllByTestId('m09-cp-target')[1]);
    await waitFor(() => expect(screen.getByTestId('m09-cp-matrix').querySelectorAll('thead th').length).toBeLessThan(10));
    fireEvent.click(screen.getByRole('tab', { name: /People/ }));
    expect((await screen.findByText('Hessa Al Dhaheri', {}, W))).toBeTruthy();
    expect(screen.queryByText('Tariq Mahmood')).toBeNull();
  });
  it('a contractor sees their own passport: skills with basis, the evidence drawer, engagements and academy credentials', async () => {
    await renderPage(<PartnerPassportPage />, { persona: 'k-contractor', path: '/partner/workforce/passport' });
    const pass = await screen.findByTestId('m09-cp-passport', {}, W);
    expect(screen.queryByTestId('m09-cp-matrix')).toBeNull();
    expect(within(pass).getAllByTestId('m09-cp-skill').length).toBeGreaterThan(3);
    fireEvent.click(within(pass).getAllByTestId('m09-cp-basis')[0]);
    const ev = await screen.findByTestId('m09-cp-evidence', {}, W);
    expect(within(ev).getAllByTestId('m09-cp-evidence-row').length).toBeGreaterThan(0);
    expect(ev.textContent).toMatch(/ENEC engagement ENG-RFO-U[12]-2025|Self-rated/);
    expect(pass.textContent).toMatch(/Simulated mirror/);
  });
  it('a contractor wraps a valid academy certificate as a badge behind a confirmation', async () => {
    await renderPage(<PartnerPassportPersonPage />, { persona: 'alnoor-qaqc', path: '/partner/workforce/passport/p-alnoor-qaqc', route: '/partner/workforce/passport/:personId' });
    const wraps = await screen.findAllByTestId('m09-cp-wrap', {}, W);
    fireEvent.click(wraps[0]);
    await confirm();
    await waitFor(() => expect(screen.getAllByTestId('m09-cp-badges').length).toBe(1), W);
    expect(getLocalBackend().raw('badges').some((b) => b.person_id === 'p-alnoor-qaqc')).toBe(true);
  });
  it('another organisation\'s contractor is not found', async () => {
    await renderPage(<PartnerPassportPersonPage />, { persona: 'alnoor-gm', path: '/partner/workforce/passport/c-gulf-03', route: '/partner/workforce/passport/:personId' });
    expect(await screen.findByText('Passport not found', {}, W)).toBeTruthy();
    expect(screen.queryByTestId('m09-cp-passport')).toBeNull();
  });
  it('the pre-check shows likely coverage per task with reasons, changes nothing, and submits through submitEquivalency', async () => {
    await renderPage(<PartnerPrecheckPage />, { persona: 'alnoor-gm', path: '/partner/workforce/precheck?person=c-alnoor-06&standard=qs-elec' });
    fireEvent.click(await screen.findByTestId('m09-pc-run', {}, W));
    const res = await screen.findByTestId('m09-pc-result', {}, W);
    expect(within(res).getAllByTestId('m09-pc-task').length).toBe(3);
    fireEvent.click(within(res).getAllByTestId('m09-pc-why')[0]);
    expect((await screen.findAllByTestId('m09-pc-why-panel'))[0].textContent).toMatch(/level|evaluator/);
    const before = getLocalBackend().raw('equivalency_requests').length;
    fireEvent.click(screen.getByTestId('m09-pc-submit'));
    await confirm();
    await waitFor(() => expect(getLocalBackend().raw('equivalency_requests').length).toBe(before + 1), W);
    const r = getLocalBackend().raw('equivalency_requests').at(-1)!;
    expect([r.person_id, r.standard_id, r.status]).toEqual(['c-alnoor-06', 'qs-elec', 'submitted']);
    expect(await screen.findByTestId('m09-pc-open', {}, W)).toBeTruthy();
  });
  it('the security standard is never offered', async () => {
    await renderPage(<PartnerPrecheckPage />, { persona: 'alnoor-gm', path: '/partner/workforce/precheck?person=c-alnoor-02' });
    await screen.findByTestId('m09-pc-run', {}, W);
    const opts = Array.from(document.querySelectorAll('select[name="std"] option')).map((o) => o.textContent ?? '');
    expect(opts.length).toBeGreaterThan(5);
    expect(opts.some((o) => /SEC-QUAL|Security officer/.test(o))).toBe(false);
  });
  it('an ENEC evaluator reads the passport read-only with the pre-check for the open request', async () => {
    await renderPage(<EquivalencyPassportPage />, { persona: 'training-mgr', path: '/training/equivalency/passport/c-alnoor-02', route: '/training/equivalency/passport/:personId' });
    expect(await screen.findByTestId('m09-cp-passport', {}, W)).toBeTruthy();
    expect(screen.getByTestId('m09-cp-name').textContent).toBe('Contractor technician A-02');
    expect(screen.queryByTestId('m09-cp-wrap')).toBeNull();
    fireEvent.click(screen.getByTestId('m09-pc-run'));
    const res = await screen.findByTestId('m09-pc-result', {}, W);
    expect(res.getAttribute('data-outlook')).toBe('likely_equivalent');
    expect(screen.queryByTestId('m09-pc-submit')).toBeNull();
  });
  it('ENEC admins set contracted role profiles behind a confirmation; security roles are not offered', async () => {
    await renderPage(<AdminContractRolesPage />, { persona: 'ai-governance', path: '/admin/suppliers/contract-roles' });
    fireEvent.click(await screen.findByTestId('m09-crt-new', {}, W));
    const form = screen.getByTestId('m09-crt-form');
    fireEvent.change(within(form).getAllByRole('combobox')[0], { target: { value: 'org-dhafra' } });
    fireEvent.change(within(form).getAllByRole('combobox')[1], { target: { value: 'chemistry-technician' } });
    expect(Array.from(within(form).getAllByRole('combobox')[1].querySelectorAll('option')).some((o) => o.getAttribute('value') === 'security-officer')).toBe(false);
    fireEvent.click(screen.getByTestId('m09-crt-save'));
    await confirm();
    await waitFor(() => expect(getLocalBackend().rawGet('contract_role_targets' as never, 'crt-org-dhafra-chemistry-technician')).toBeTruthy(), W);
  });
  it('auditors read contracted role profiles only', async () => {
    await renderPage(<AdminContractRolesPage />, { persona: 'k-auditor', path: '/admin/suppliers/contract-roles' });
    expect(await screen.findByText(/Read-only/, {}, W)).toBeTruthy();
    expect(screen.queryByTestId('m09-crt-new')).toBeNull();
  });
  it('renders in Arabic', async () => {
    await renderPage(<PartnerPassportPage />, { persona: 'alnoor-gm', path: '/ar/partner/workforce/passport' });
    expect(await screen.findByTestId('m09-cp-matrix', {}, W)).toBeTruthy();
    expect(document.body.textContent).toMatch(/مصفوفة الفريق/);
  });
});
