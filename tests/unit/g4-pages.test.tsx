// @vitest-environment jsdom
/** [G4] M09/M11 pages rendered with testing-library (real providers, in-memory LocalBackend). */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderG4 } from './g4-harness';
import PartnersPage from '../../src/modules/m09/PartnersPage';
import PartnersDetailPage from '../../src/modules/m09/PartnersDetailPage';
import SuppliersPage from '../../src/modules/m09/SuppliersPage';
import PartnerPage from '../../src/modules/m09/PartnerPage';
import PartnerOnboardingPage from '../../src/modules/m09/PartnerOnboardingPage';
import PartnerSummaryPage from '../../src/modules/m09/PartnerSummaryPage';
import PartnerAcademyPage from '../../src/modules/m09/PartnerAcademyPage';
import PartnerWorkforcePage from '../../src/modules/m09/PartnerWorkforcePage';
import PartnerIcvPage from '../../src/modules/m09/PartnerIcvPage';
import AdminSuppliersPage from '../../src/modules/m09/AdminSuppliersPage';
import TrainingEquivalencyPage from '../../src/modules/m09/TrainingEquivalencyPage';
import FuturePage from '../../src/modules/m11/FuturePage';
import FutureTechPage from '../../src/modules/m11/FutureTechPage';
import WorkforceFuturePage from '../../src/modules/m11/WorkforceFuturePage';

const T = { timeout: 8000 };

describe('M09 public pages', () => {
  it('the directory lists every partner with at least one public source link and shows oversight apart', async () => {
    await renderG4(<PartnersPage />, { path: '/partners' });
    const list = await screen.findByTestId('m09-directory', {}, T);
    const cards = within(list).getAllByTestId('m09-partner-card');
    expect(cards.length).toBeGreaterThanOrEqual(50);
    for (const c of cards) expect(within(c).getAllByRole('link').some((a) => (a.getAttribute('href') ?? '').startsWith('https://'))).toBe(true);
    const oversight = screen.getByTestId('m09-oversight');
    expect(within(oversight).getByText('FANR')).toBeTruthy();
    expect(screen.getByText(/Not listed because unverified/)).toBeTruthy();
  });
  it('filters by category and switches to a table view with CSV export', async () => {
    await renderG4(<PartnersPage />, { path: '/partners?cat=fuel' });
    const list = await screen.findByTestId('m09-directory', {}, T);
    expect(within(list).getByText('Kazatomprom')).toBeTruthy();
    expect(within(list).queryByText('FANR')).toBeNull();
    fireEvent.click(screen.getByTestId('m09-view-table'));
    expect(await screen.findByTestId('data-table')).toBeTruthy();
    expect(screen.getByText('Export CSV')).toBeTruthy();
  });
  it('a partner page shows agreements with binding flags; an unknown slug shows not found', async () => {
    await renderG4(<PartnersDetailPage />, { path: '/partners/terrapower', route: '/partners/:slug' });
    expect(await screen.findByText('Non-binding evaluation', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m09-agreements')).toBeTruthy();
  });
  it('an unknown or synthetic organisation is not found on the public directory', async () => {
    await renderG4(<PartnersDetailPage />, { path: '/partners/org-alnoor', route: '/partners/:slug' });
    expect(await screen.findByText('Partner not found', {}, T)).toBeTruthy();
  });
  it('the suppliers page shows sourced facts, the readiness path, the academy and the register-interest form', async () => {
    await renderG4(<SuppliersPage />, { path: '/suppliers' });
    expect(await screen.findByText('2,000+', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m09-sup-path').querySelectorAll('li')).toHaveLength(6);
    await waitFor(() => expect(screen.getByTestId('m09-sup-courses').querySelectorAll('li')).toHaveLength(8));
    expect(screen.getByTestId('m09-sup-form')).toBeTruthy();
  });
});

describe('M09 partner portal', () => {
  it('partner home shows only the caller organisation with next steps', async () => {
    await renderG4(<PartnerPage />, { persona: 'gulfhydro-qa', path: '/partner' });
    expect(await screen.findByTestId('m09-home-next', {}, T)).toBeTruthy();
    expect(screen.getByText(/Gulf Hydro-Valve/, { selector: 'dd' })).toBeTruthy();
  });
  it('onboarding works for the partner admin and is read-only for a contractor', async () => {
    await renderG4(<PartnerOnboardingPage />, { persona: 'gulfhydro-qa', path: '/partner/onboarding' });
    expect(await screen.findByTestId('m09-onb-submit', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m09-onb-steps')).toBeTruthy();
    fireEvent.click(screen.getByTestId('m09-onb-submit'));
    expect(await screen.findByTestId('m09-onb-checklist')).toBeTruthy();
  });
  it('a contractor (partner user) follows its organisation case read-only', async () => {
    await renderG4(<PartnerOnboardingPage />, { persona: 'k-contractor', path: '/partner/onboarding' });
    expect(await screen.findByText('Read only', {}, T)).toBeTruthy();
    expect(screen.queryByTestId('m09-onb-submit')).toBeNull();
  });
  it('the readiness summary shows the reference and fingerprints for a handed-off supplier', async () => {
    await renderG4(<PartnerSummaryPage />, { persona: 'alnoor-gm', path: '/partner/onboarding/summary' });
    expect((await screen.findByTestId('m09-summary-ref', {}, T)).textContent).toMatch(/^KFA-RS-ALNOOR-\d{8}$/);
    expect(screen.getAllByText(/[0-9a-f]{64}/).length).toBeGreaterThan(5);
  });
  it('academy: a contractor sees eight courses and can open one', async () => {
    await renderG4(<PartnerAcademyPage />, { persona: 'k-contractor', path: '/partner/academy' });
    const list = await screen.findByTestId('m09-academy-courses', {}, T);
    expect(within(list).getAllByRole('listitem')).toHaveLength(8);
    fireEvent.click(screen.getByTestId('m09-academy-open-c-sa-cgd-103'));
    expect(await screen.findByTestId('m09-academy-enrol')).toBeTruthy();
  });
  it("workforce: requesting another organisation's equivalency id shows not found", async () => {
    await renderG4(<PartnerWorkforcePage />, { persona: 'alnoor-gm', path: '/partner/workforce?eq=eq-4' });
    expect(await screen.findByTestId('m09-wf-notfound', {}, T)).toBeTruthy();
  });
  it('workforce: the own organisation record opens with its mapping and history', async () => {
    await renderG4(<PartnerWorkforcePage />, { persona: 'alnoor-gm', path: '/partner/workforce?eq=eq-1' });
    const d = await screen.findByTestId('m09-wf-detail', {}, T);
    expect(within(d).getByText(/Task coverage: 4 of 4/)).toBeTruthy();
  });
  it('ICV page shows the plan with lever coverage', async () => {
    await renderG4(<PartnerIcvPage />, { persona: 'alnoor-gm', path: '/partner/icv' });
    expect(await screen.findByTestId('m09-icv-levers', {}, T)).toBeTruthy();
    expect(screen.getByText('Covers the gap')).toBeTruthy();
  });
});

describe('M09 ENEC review screens', () => {
  it('admin sees every onboarding case and can open a submitted file', async () => {
    await renderG4(<AdminSuppliersPage />, { persona: 'k-admin', path: '/admin/suppliers' });
    fireEvent.click(await screen.findByTestId('m09-adm-open-po-tarsus', {}, T));
    expect(await screen.findByTestId('m09-adm-case')).toBeTruthy();
    expect((screen.getByTestId('m09-adm-approve') as HTMLButtonElement).disabled).toBe(true); // documents not yet accepted
  });
  it('the evaluator queue shows contractor organisation names', async () => {
    await renderG4(<TrainingEquivalencyPage />, { persona: 'training-mgr', path: '/training/equivalency' });
    expect((await screen.findAllByText(/Al Noor Precision Engineering/, {}, T)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('m09-eqr-open-eq-2'));
    expect(await screen.findByTestId('m09-eqr-mapping')).toBeTruthy();
  });
});

describe('M11 pages', () => {
  it('the public page carries the no-decision line, six sourced technologies and no headcount', async () => {
    await renderG4(<FuturePage />, { path: '/future' });
    const cards = await screen.findAllByTestId('m11-tech-card', {}, T);
    expect(cards).toHaveLength(6);
    for (const c of cards) expect(within(c).getAllByRole('link').some((a) => (a.getAttribute('href') ?? '').startsWith('https://'))).toBe(true);
    expect(screen.getAllByTestId('m11-no-decision').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('ENEC is evaluating these technologies; no deployment decision is implied.').length).toBeGreaterThanOrEqual(2);
    expect(document.body.textContent).not.toMatch(/\b\d+\s*(staff|people|jobs|positions|headcount)\b/i);
    expect(screen.getByTestId('m11-future-roles')).toBeTruthy();
  });
  it('renders in Arabic', async () => {
    await renderG4(<FuturePage />, { path: '/ar/future' });
    expect((await screen.findAllByText('تقيّم ENEC هذه التقنيات؛ ولا يعني ذلك أي قرار بالنشر.', {}, T)).length).toBeGreaterThanOrEqual(1);
  });
  it('a technology page links its MoU partners to the directory; an unknown one is not found', async () => {
    await renderG4(<FutureTechPage />, { path: '/future/bwr', route: '/future/:tech' });
    const orgs = await screen.findByTestId('m11-tech-orgs', {}, T);
    expect(within(orgs).getByText('GE Hitachi / GE Vernova Hitachi')).toBeTruthy();
  });
  it('an unknown technology shows not found', async () => {
    await renderG4(<FutureTechPage />, { path: '/future/x', route: '/future/:tech' });
    expect(await screen.findByText('Technology not found', {}, T)).toBeTruthy();
  });
  it('HR sees the SIMULATED radar and gap table', async () => {
    await renderG4(<WorkforceFuturePage />, { persona: 'k-hr-analyst', path: '/workforce/future' });
    expect(await screen.findByText(/SIMULATED: scenarios, not forecasts/, {}, T)).toBeTruthy();
    expect(screen.getByTestId('m11-new-plan')).toBeTruthy();
  });
});
