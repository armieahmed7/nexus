// @vitest-environment jsdom
/** FS41/FS42/FS43 pages rendered with the real providers and the in-memory LocalBackend: the public CleanEnergyComp framework (anonymous,
 *  EN and AR), one competence with outcomes side by side, my progress with reasons and a goal, the HR aggregate with suppression, the
 *  energy-transition hub, a value chain with sourced facts and the pathway envelope, and the ESG track (under 10 hours, credential route).
 *  Every page shows its benchmark chips. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import CleanEnergyPage from '../../src/modules/m32/CleanEnergyPage';
import CecCompetencePage from '../../src/modules/m32/CecCompetencePage';
import MyCleanEnergyPage from '../../src/modules/m32/MyCleanEnergyPage';
import WorkforceCleanEnergyPage from '../../src/modules/m32/WorkforceCleanEnergyPage';
import EnergyTransitionPage from '../../src/modules/m32/EnergyTransitionPage';
import ValueChainPage from '../../src/modules/m32/ValueChainPage';
import EsgManagersPage from '../../src/modules/m32/EsgManagersPage';

const W = { timeout: 30000 };

describe('FS41/FS42/FS43 pages', () => {
  it('the public framework shows 12 competences with outcomes, the matrix, targets for every family, a passing check and the FS41 chips (anonymous)', async () => {
    await renderPage(<CleanEnergyPage />, { persona: null, path: '/skills/clean-energy' });
    await waitFor(() => expect(screen.getAllByTestId('m32-fw-competence').length).toBe(12), { timeout: 90000 });
    expect(screen.getAllByTestId('m32-fw-outcomes').every((u) => u.querySelectorAll('li').length >= 2)).toBe(true);
    expect(screen.getByTestId('m32-fw-matrix').querySelectorAll('tbody tr').length).toBe(12);
    expect(screen.getByTestId('m32-fw-targets').querySelectorAll('tbody tr').length).toBe(20);
    const check = screen.getByTestId('m32-fw-check');
    expect(check.getAttribute('data-problems')).toBe('0');
    expect(check.getAttribute('data-clean')).toBe('true');
    expect(screen.getByTestId('m32-signin')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-GREENCOMP')).toBeTruthy(), W);
    expect(screen.getByTestId('benchmark-chip-JAHIZ')).toBeTruthy();
    fireEvent.click(screen.getByTestId('m32-fw-area-acting'));
    expect(screen.getAllByTestId('m32-fw-competence').length).toBe(3);
  }, 150000);
  it('the framework renders in Arabic with the four area names', async () => {
    await renderPage(<CleanEnergyPage />, { persona: null, path: '/ar/skills/clean-energy' });
    await waitFor(() => expect(screen.getAllByTestId('m32-fw-competence').length).toBe(12), W);
    for (const s of ['تجسيد القيم', 'تقبّل التعقيد', 'استشراف المستقبل', 'العمل من أجل الاستدامة', 'كفاءات الطاقة النظيفة']) expect(document.body.textContent).toContain(s);
  }, 60000);
  it('a competence shows its outcomes in English and Arabic side by side, its learning items and focus families', async () => {
    await renderPage(<CecCompetencePage />, { persona: null, path: '/skills/clean-energy/cec-3-2', route: '/skills/clean-energy/:id' });
    const tbl = await screen.findByTestId('m32-comp-outcomes', {}, W);
    const rows = tbl.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const r of Array.from(rows)) expect(r.textContent).toMatch(/[؀-ۿ]/);
    expect(within(screen.getByTestId('m32-comp-learning')).getAllByRole('listitem').length).toBeGreaterThanOrEqual(1);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-GREENCOMP')).toBeTruthy(), W);
  }, 60000);
  it('my progress: level per area and overall against my family target, reasons, grow next and a goal (nse, level 0)', async () => {
    // FS wave F QA: k-ro now holds validated role-play evidence on two transversal skills (FS59); nse has no counted evidence
    await renderPage(<MyCleanEnergyPage />, { persona: 'nse', path: '/my/clean-energy' });
    const sum = await screen.findByTestId('m32-my-summary', {}, W);
    expect(sum.getAttribute('data-level')).toBe('0');
    expect(screen.getAllByTestId('m32-my-area').length).toBe(4);
    expect(screen.getAllByTestId('m32-my-competence').length).toBe(12);
    expect(screen.getAllByTestId('m32-my-next-item').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByTestId('m32-my-why-overall'));
    expect((await screen.findByTestId('m32-my-why-overall-panel')).textContent).toMatch(/no counted evidence/i);
    fireEvent.click(screen.getByTestId('m32-my-filter-grow'));
    expect(screen.getAllByTestId('m32-my-competence').every((li) => ['below', 'none'].includes(li.getAttribute('data-status') ?? ''))).toBe(true);
    fireEvent.click(screen.getAllByTestId('m32-my-goal')[0]);
    fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
    await waitFor(() => expect(document.body.textContent).toContain('Goal added'), W);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-WEF-FOJ')).toBeTruthy(), W);
  }, 90000);
  it('my progress at target (head of sustainability, Arabic): level 2 met', async () => {
    await renderPage(<MyCleanEnergyPage />, { persona: 'head-sustainability', path: '/ar/my/clean-energy' });
    const sum = await screen.findByTestId('m32-my-summary', {}, W);
    expect(sum.getAttribute('data-level')).toBe('2');
    expect(sum.getAttribute('data-status')).toBe('met');
    expect(document.body.textContent).toContain('كفاءاتي في الطاقة النظيفة');
  }, 60000);
  it('the HR view shows level and area shares with families under ten suppressed and security never broken out (chco)', async () => {
    await renderPage(<WorkforceCleanEnergyPage />, { persona: 'chco', path: '/workforce/clean-energy' });
    const fam = await screen.findByTestId('m32-wf-families', {}, W);
    expect(fam.querySelectorAll('tbody tr').length).toBeGreaterThanOrEqual(3);
    expect(fam.querySelectorAll('[data-suppressed="true"]').length).toBeGreaterThanOrEqual(1);
    expect(fam.textContent).not.toMatch(/Security|Safeguards|Cyber/);
    expect(screen.getByTestId('m32-wf-areas')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-GREENCOMP')).toBeTruthy(), W);
  }, 60000);
  it('staff without aggregate access see no figures', async () => {
    await renderPage(<WorkforceCleanEnergyPage />, { persona: 'k-ro', path: '/workforce/clean-energy' });
    await waitFor(() => expect(document.body.textContent).toContain('This view is for HR aggregate readers'), W);
    expect(screen.queryByTestId('m32-wf-families')).toBeNull();
  }, 60000);
  it('the hub shows three value chains and two tracks with envelope and weekly hours, and the FS42 and FS43 chips', async () => {
    await renderPage(<EnergyTransitionPage />, { persona: 'k-ro', path: '/learn/energy-transition' });
    await waitFor(() => expect(screen.getAllByTestId('m32-hub-chain').length).toBe(3), W);
    expect(screen.getAllByTestId('m32-hub-track').length).toBe(2);
    expect(document.body.textContent).toMatch(/no ENEC project, site or deployment decision is implied/);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-NEA')).toBeTruthy(), W);
    expect(screen.getByTestId('benchmark-chip-ISO30414')).toBeTruthy();
  }, 60000);
  it('a value chain shows stages, sourced facts with dates, lanes and the pathway with its envelope (Arabic)', async () => {
    await renderPage(<ValueChainPage />, { persona: 'k-ro', path: '/ar/learn/energy-transition/vc-hydrogen', route: '/ar/learn/energy-transition/:chainId' });
    const facts = await screen.findByTestId('m32-chain-facts', {}, W);
    const items = within(facts).getAllByTestId('m32-chain-fact');
    expect(items.length).toBeGreaterThanOrEqual(2);
    for (const li of items) expect(li.querySelector('a[href^="https://"]')).toBeTruthy();
    expect(within(screen.getByTestId('m32-chain-lanes')).getAllByRole('listitem').length).toBeGreaterThanOrEqual(1);
    const track = await screen.findByTestId('m32-track', {}, W);
    expect(track.getAttribute('data-id')).toBe('tt-system-integration');
    expect(within(screen.getByTestId('m32-track-tiles')).getAllByText(/ساعة|أشهر/).length).toBeGreaterThanOrEqual(2);
    await waitFor(() => expect(screen.getAllByTestId('m32-track-step').length).toBe(5), W);
    expect(screen.getByTestId('m32-cred-draft')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-ENERGY-JOBS')).toBeTruthy(), W);
  }, 60000);
  it('the ESG track is under 10 hours with its weekly cost, every step fits and every MC-CLEAN-ENERGY criterion is covered; starting it asks first', async () => {
    await renderPage(<EsgManagersPage />, { persona: 'k-ro', path: '/learn/energy-transition/esg-managers' });
    const cost = await screen.findByTestId('m32-esg-cost', {}, W);
    expect(Number(cost.getAttribute('data-total'))).toBeLessThan(10);
    expect(cost.getAttribute('data-weekly')).toBe('1');
    await waitFor(() => expect(screen.getAllByTestId('m32-track-step').length).toBe(4), W);
    expect(screen.getByTestId('m32-quick').getAttribute('data-fit')).toBe('true');
    const crit = within(screen.getByTestId('m32-cred-route')).getAllByTestId('m32-cred-criterion');
    expect(crit.length).toBe(2);
    expect(crit.every((c) => c.getAttribute('data-covered') === 'true')).toBe(true);
    expect(screen.getByTestId('m32-cred-link')).toBeTruthy();
    fireEvent.click(screen.getByTestId('m32-track-start'));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
    await waitFor(() => expect(screen.getByTestId('m32-track-progress')).toBeTruthy(), W);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-ISO30414')).toBeTruthy(), W);
  }, 90000);
});
