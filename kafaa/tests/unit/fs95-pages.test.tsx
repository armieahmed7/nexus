// @vitest-environment jsdom
/** FS84 pages rendered with the real providers and the in-memory LocalBackend: the team 2028/2030 targets (the crew B shift manager sees
 *  derived targets with the role-profile version chips, Why this, the stale adoption flag, member readiness by name; the 2028 switch; the
 *  confirmed adoption; HR sees counts only; Arabic) and the organisation skills inventory (data-quality tiles with definitions, suppressed
 *  heatmap cells, the family view; refused for line managers through the route guard). Both pages show the FS84 benchmark chips. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { RequireGuard } from '../../src/auth/guards';
import { routes } from '../../src/modules/m17/routes';
import TeamFutureTargetsPage from '../../src/modules/m17/TeamFutureTargetsPage';
import SkillsInventoryPage from '../../src/modules/m17/SkillsInventoryPage';

const W = { timeout: 90000 };
const invGuard = routes.find((r) => r.id === 'workforce-skills-inventory')!.guard;
const GuardedInv = () => <RequireGuard guard={invGuard} routeId="workforce-skills-inventory"><SkillsInventoryPage /></RequireGuard>;

describe('FS84 team targets page', () => {
  it('the shift manager sees crew B\'s 2030 targets, each with the 2030 role-profile version it came from, Why this, and the stale adoption flag', async () => {
    await renderPage(<TeamFutureTargetsPage />, { persona: 'sro', path: '/team/skills/future' });
    const root = await screen.findByTestId('m17-tt', {}, W);
    expect(root.getAttribute('data-horizon')).toBe('2030');
    expect(root.getAttribute('data-mode')).toBe('people');
    const rows = screen.getAllByTestId('m17-tt-row');
    expect(rows.length).toBeGreaterThan(10);
    for (const r of rows) expect(within(r).getByTestId('m17-tt-from').querySelectorAll('[data-version]').length).toBeGreaterThan(0);
    const ai = rows.find((r) => r.getAttribute('data-skill') === 'sk-fs-ai-verify')!;
    expect([...within(ai).getByTestId('m17-tt-from').querySelectorAll('[data-version]')].map((x) => x.getAttribute('data-version'))).toContain('rpv-reactor-operator-2030-v2');
    expect(within(ai).getByTestId('m17-tt-from').textContent).toMatch(/2030 v2/);
    fireEvent.click(within(ai).getByTestId('m17-tt-why-sk-fs-ai-verify'));
    expect((await screen.findByTestId('m17-tt-why-sk-fs-ai-verify-panel')).textContent).toMatch(/version 2/);
    expect(screen.getByTestId('m17-tt-changed').textContent).toMatch(/no longer match/);
    expect(screen.getByTestId('m17-tt-adoption').getAttribute('data-up-to-date')).toBe('false');
    expect(screen.getByTestId('m17-tt-adoption').textContent).toMatch(/Adopted on/);
    expect(screen.getAllByTestId('m17-tt-was').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m17-tt-members').querySelectorAll('tbody tr').length).toBe(8);
    expect(screen.getByTestId('m17-tt-assumption').textContent).toMatch(/2030 role profile/);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-ISO30414')).toBeTruthy(), W);
    expect(screen.getByTestId('benchmark-chip-IAEA-WFP')).toBeTruthy();
  }, 180000);
  it('the 2028 switch shows the half-way targets; adopting them is confirmed first and then reads as up to date', async () => {
    await renderPage(<TeamFutureTargetsPage />, { persona: 'sro', path: '/team/skills/future' });
    await screen.findByTestId('m17-tt', {}, W);
    fireEvent.click(screen.getByTestId('m17-tt-h-2028'));
    await waitFor(() => expect(screen.getByTestId('m17-tt').getAttribute('data-horizon')).toBe('2028'), W);
    expect(screen.getByTestId('m17-tt-assumption').textContent).toMatch(/half-way/);
    expect(screen.getByTestId('m17-tt-adoption').textContent).toMatch(/Not adopted yet/);
    fireEvent.click(screen.getByTestId('m17-tt-adopt'));
    const dlg = await screen.findByRole('dialog', {}, W);
    expect(dlg.textContent).toMatch(/audit log/);
    fireEvent.click(within(dlg).getByRole('button', { name: /Adopt as team targets/ }));
    await waitFor(() => expect(screen.getByTestId('m17-tt-adoption').getAttribute('data-up-to-date')).toBe('true'), W);
    expect((screen.getByTestId('m17-tt-adopt') as HTMLButtonElement).disabled).toBe(true);
  }, 180000);
  it('the HR director sees counts only: no member table, no adopt button, and small teams suppressed', async () => {
    await renderPage(<TeamFutureTargetsPage />, { persona: 'chco', path: '/team/skills/future' });
    const root = await screen.findByTestId('m17-tt', {}, W);
    expect(root.getAttribute('data-mode')).toBe('aggregate');
    expect(screen.queryByTestId('m17-tt-members')).toBeNull();
    expect(screen.queryByTestId('m17-tt-adopt')).toBeNull();
    expect(screen.getByTestId('m17-tt-who-adopts')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Team or group|Group/i), { target: { value: 'team:rp' } });
    await waitFor(() => expect(screen.getByTestId('m17-tt-suppressed')).toBeTruthy(), W);
    expect(screen.getByTestId('m17-tt-tiles').querySelectorAll('[data-suppressed="true"]').length).toBeGreaterThan(2);
  }, 180000);
  it('in Arabic the targets page renders with Arabic labels', async () => {
    await renderPage(<TeamFutureTargetsPage />, { persona: 'sro', path: '/ar/team/skills/future' });
    await screen.findByTestId('m17-tt', {}, W);
    expect(screen.getByTestId('m17-tt-assumption').textContent).toMatch(/ملف الدور/);
    expect(screen.getByTestId('m17-tt-method').textContent).toMatch(/كفاءة/);
  }, 120000);
});

describe('FS84 organisation skills inventory page', () => {
  it('HR sees the data-quality tiles with their definitions and the area x entity heatmap with suppressed cells', async () => {
    await renderPage(<SkillsInventoryPage />, { persona: 'chco', path: '/workforce/skills-inventory' });
    const root = await screen.findByTestId('m17-inv', {}, W);
    expect(root.getAttribute('data-dim')).toBe('entity');
    const tiles = screen.getByTestId('m17-inv-quality');
    expect(tiles.textContent).toMatch(/Profile coverage/);
    expect(tiles.textContent).toMatch(/Stale states/);
    expect(tiles.textContent).toMatch(/Share validated/);
    expect(screen.getByTestId('m17-inv-definitions').querySelectorAll('li').length).toBe(5);
    const areas = screen.getByTestId('m17-inv-areas');
    expect(areas.textContent).toMatch(/<10/);
    expect(areas.textContent).toMatch(/All staff/);
    expect(screen.getByTestId('m17-inv-skills').querySelectorAll('details').length).toBeGreaterThan(10);
    expect(screen.getByTestId('m17-inv-quality-groups').querySelectorAll('[data-suppressed="true"]').length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-ISO30414')).toBeTruthy(), W);
  }, 180000);
  it('the job-family view suppresses small families and explains why (HR analyst)', async () => {
    await renderPage(<SkillsInventoryPage />, { persona: 'k-hr-analyst', path: '/workforce/skills-inventory' });
    await screen.findByTestId('m17-inv', {}, W);
    fireEvent.click(screen.getByTestId('m17-inv-dim-family'));
    await waitFor(() => expect(screen.getByTestId('m17-inv').getAttribute('data-dim')).toBe('family'), W);
    expect(screen.getByTestId('m17-inv-areas').textContent).toMatch(/<10/);
    expect(screen.getByTestId('m17-inv-areas').textContent).not.toMatch(/Security/);
  }, 180000);
  it('line managers and auditors never reach the inventory: the guard shows the forbidden screen', async () => {
    for (const p of ['sro', 'k-auditor']) {
      const { unmount } = await renderPage(<GuardedInv />, { persona: p, path: '/workforce/skills-inventory' });
      expect(await screen.findByTestId('forbidden', {}, W)).toBeTruthy();
      expect(screen.queryByTestId('m17-inv')).toBeNull();
      unmount();
    }
  }, 120000);
});
