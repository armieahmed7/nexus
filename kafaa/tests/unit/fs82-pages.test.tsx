// @vitest-environment jsdom
/** FS73/FS74 pages rendered with the real providers and the in-memory LocalBackend: the Emirati pipeline (tiles, areas with suppressed
 *  cells and WhyThis, the scope switch, the SIMULATED mirror and "not an authority" notes; refused for observers and partners through the
 *  route guard), my Future Skills Wallet (five items from evidence, next steps, the item already in my plan, the confirmed "add to my plan"
 *  step, the leadership target with who and when) and the counter (definition, target date, who set it, items and families; the HR
 *  director's confirmed target setting). Every page shows its benchmark chips. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { RequireGuard } from '../../src/auth/guards';
import { routes } from '../../src/modules/m37/routes';
import EmiratiPipelinePage from '../../src/modules/m37/EmiratiPipelinePage';
import FutureWalletPage from '../../src/modules/m37/FutureWalletPage';
import FutureWalletCounterPage from '../../src/modules/m37/FutureWalletCounterPage';

const W = { timeout: 90000 };
const guard = routes.find((r) => r.id === 'national-emirati-pipeline')!.guard;
const Guarded = () => <RequireGuard guard={guard} routeId="national-emirati-pipeline"><EmiratiPipelinePage /></RequireGuard>;

describe('FS73 page', () => {
  it('the HR director sees the pipeline by competency area: tiles, suppressed cells with "<10", WhyThis per area, the mirror notes and the FS73 chips', async () => {
    await renderPage(<EmiratiPipelinePage />, { persona: 'chco', path: '/national/emirati-pipeline' });
    const body = await screen.findByTestId('m37-ep-body', {}, W);
    expect(body.getAttribute('data-scope')).toBe('all');
    expect(screen.getByTestId('m37-ep-tile-successors').getAttribute('data-value')).not.toBe('');
    const areas = screen.getAllByTestId('m37-ep-area');
    expect(areas.length).toBeGreaterThanOrEqual(5);
    expect(areas.at(-1)!.getAttribute('data-family')).toBe('total');
    expect(screen.getByTestId('m37-ep-areas').querySelectorAll('[data-suppressed="true"]').length).toBeGreaterThan(5);
    fireEvent.click(within(areas[0]).getByTestId('m37-ep-why'));
    expect((await screen.findByTestId('m37-ep-why-panel')).textContent).toMatch(/critical or future roles/);
    expect(screen.getByTestId('m37-ep-retention').getAttribute('data-simulated')).toBe('true');
    expect(screen.getByTestId('m37-ep-not-authority').textContent).toMatch(/not issue/);
    expect(screen.getByTestId('m37-ep-agg').textContent).toMatch(/never enters any score/);
    expect(screen.getAllByTestId('m37-ep-role').length).toBe(14);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-NAFIS')).toBeTruthy(), W);
    expect(screen.getByTestId('benchmark-chip-IAEA-WFP')).toBeTruthy();
  }, 180000);
  it('the scope switch recomputes the report for future roles only (auditor)', async () => {
    await renderPage(<EmiratiPipelinePage />, { persona: 'k-auditor', path: '/national/emirati-pipeline' });
    await screen.findByTestId('m37-ep-body', {}, W);
    fireEvent.click(screen.getByTestId('m37-ep-scope-future'));
    await waitFor(() => expect(screen.getByTestId('m37-ep-body').getAttribute('data-scope')).toBe('future'), W);
    expect(screen.getAllByTestId('m37-ep-role').length).toBe(10);
    expect(screen.queryByTestId('m37-ep-succession')).toBeNull(); // auditors do not read talent review
  }, 120000);
  it('observers and partners never reach the page: the guard shows the forbidden screen and the report is never rendered', async () => {
    for (const p of ['k-observer', 'alnoor-gm']) {
      const { unmount } = await renderPage(<Guarded />, { persona: p, path: '/national/emirati-pipeline' });
      expect(await screen.findByTestId('forbidden', {}, W)).toBeTruthy();
      expect(screen.queryByTestId('m37-ep')).toBeNull();
      unmount();
    }
  }, 120000);
  it('in Arabic the pipeline renders with Arabic labels', async () => {
    await renderPage(<EmiratiPipelinePage />, { persona: 'k-hr-analyst', path: '/ar/national/emirati-pipeline' });
    await screen.findByTestId('m37-ep-body', {}, W);
    expect(screen.getByTestId('m37-ep-agg').textContent).toMatch(/الجنسية/);
  }, 120000);
});

describe('FS74 pages', () => {
  it('my wallet shows the five items from evidence, next steps for open items, the item already in my plan and the target with who and when', async () => {
    await renderPage(<FutureWalletPage />, { persona: 'k-ro', path: '/my/future-wallet' });
    const w = await screen.findByTestId('m37-fw', {}, W);
    const items = screen.getAllByTestId('m37-fw-item');
    expect(items.map((x) => x.getAttribute('data-key'))).toEqual(['ai_rung2', 'cyber_hygiene', 'plant_data', 'core_skill', 'cec_l1']);
    const open = items.filter((x) => x.getAttribute('data-met') === 'false');
    expect(Number(w.getAttribute('data-met'))).toBe(5 - open.length);
    for (const x of open) expect(within(x).getByTestId('m37-fw-next')).toBeTruthy();
    expect(within(items[2]).getByTestId('m37-fw-in-plan').textContent).toMatch(/in progress/);
    expect(screen.getByTestId('m37-fw-target-value').textContent).toMatch(/60/);
    expect(screen.getByTestId('m37-fw-target-who').textContent).toMatch(/Chief Human Capital Officer \(role card\)/);
    fireEvent.click(within(items[0]).getByTestId('m37-fw-why'));
    expect((await screen.findByTestId('m37-fw-why-panel')).textContent).toMatch(/self-ratings never/);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-JAHIZ')).toBeTruthy(), W);
  }, 180000);
  it('adding the open items to my plan is confirmed first, then the items read "in my plan"', async () => {
    await renderPage(<FutureWalletPage />, { persona: 'k-lo-trainee', path: '/my/future-wallet' }); // three open items, an active plan
    await screen.findByTestId('m37-fw', {}, W);
    const before = screen.queryAllByTestId('m37-fw-in-plan').length;
    fireEvent.click(screen.getByTestId('m37-fw-add-plan'));
    const dlg = await screen.findByRole('dialog', {}, W);
    fireEvent.click(within(dlg).getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(screen.getAllByTestId('m37-fw-in-plan').length).toBeGreaterThan(before), W);
    expect((screen.getByTestId('m37-fw-add-plan') as HTMLButtonElement).disabled).toBe(true);
  }, 180000);
  it('the counter shows its definition, the target date and who set it, the items and families, with suppressed cells (HR director)', async () => {
    await renderPage(<FutureWalletCounterPage />, { persona: 'chco', path: '/national/future-wallet' });
    await screen.findByTestId('m37-fwc', {}, W);
    expect(screen.getByTestId('m37-fwc-definition').querySelectorAll('li').length).toBe(5);
    expect(screen.getByTestId('m37-fwc-tiles').textContent).toMatch(/Dec|2027/);
    expect(screen.getByTestId('m37-fw-target-who').textContent).toMatch(/Set by .*role card/);
    expect(screen.getByTestId('m37-fwc-suppressed')).toBeTruthy(); // fewer than 10 hold all five today
    expect(screen.getByTestId('m37-fwc-items')).toBeTruthy();
    expect(screen.getByTestId('m37-fwc-families')).toBeTruthy();
    expect(screen.getByTestId('m37-fwc-set')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-UAE-AI')).toBeTruthy(), W);
  }, 180000);
  it('the HR director sets a new target after a confirmation; the setting shows version 2 with the earlier one in the history', async () => {
    await renderPage(<FutureWalletCounterPage />, { persona: 'chco', path: '/national/future-wallet' });
    await screen.findByTestId('m37-fwc-set', {}, W);
    fireEvent.change(screen.getByLabelText(/Share of staff/), { target: { value: '65' } });
    fireEvent.change(screen.getByLabelText(/Note \(English\)/), { target: { value: 'Leadership raised the demo target.' } });
    fireEvent.change(screen.getByLabelText(/Note \(Arabic\)/), { target: { value: 'رفعت القيادة هدف العرض التوضيحي.' } });
    fireEvent.click(screen.getByTestId('m37-fwc-save'));
    const dlg = await screen.findByRole('dialog', {}, W);
    fireEvent.click(within(dlg).getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(screen.getByTestId('m37-fw-target').getAttribute('data-version')).toBe('2'), W);
    expect(screen.getByTestId('m37-fwc-history').querySelectorAll('tbody tr').length).toBe(1);
  }, 180000);
  it('the HR analyst reads the counter but cannot set the target', async () => {
    await renderPage(<FutureWalletCounterPage />, { persona: 'k-hr-analyst', path: '/national/future-wallet' });
    await screen.findByTestId('m37-fwc', {}, W);
    expect(screen.queryByTestId('m37-fwc-set')).toBeNull();
    expect(screen.getByTestId('m37-fwc-who-sets')).toBeTruthy();
  }, 120000);
});
