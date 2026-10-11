// @vitest-environment jsdom
/** FS34 / FS35 pages (FS wave D · E4): /careers/translate for an anonymous career-changer (nothing stored: no RPC, no write, no
 * Storage), the staff "my passport" tab, Arabic; /my/career/health for k-ro through Assess, Chart and Execute (the conversation is
 * booked through the existing F12 rpc.submitPrep), the five components with inputs and no hidden score, Arabic. */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import CareersTranslatePage from '../../src/modules/m18/CareersTranslatePage';
import MyCareerHealthPage from '../../src/modules/m18/MyCareerHealthPage';
import en from '../../src/i18n/m18.en.json';
import ar from '../../src/i18n/m18.ar.json';

const T = { timeout: 20000 };

describe('/careers/translate (FS34)', () => {
  it('anonymous: picks an occupation and gets roles, delta skills and a bridging route; no RPC, no write, no storage', async () => {
    await renderPage(<CareersTranslatePage />, { path: '/careers/translate', persona: null });
    const list = await screen.findByTestId('m18-fs34-occupations', {}, T);
    const cards = within(list).getAllByTestId('m18-fs34-occupation');
    expect(cards.length).toBeGreaterThanOrEqual(8);
    expect(screen.getByTestId('m18-fs34-privacy').textContent).toBe(en.fs34.privacy);
    await waitFor(() => expect(Array.from(document.querySelectorAll('button[data-testid^="benchmark-chip-"]')).map((x) => x.getAttribute('data-testid'))).toEqual(expect.arrayContaining(['benchmark-chip-UK-NUC', 'benchmark-chip-SMR-WF', 'benchmark-chip-ESCO'])), T);
    // spies from here on: every RPC, every direct write and both storages
    const b = getLocalBackend();
    const rpcSpies = Object.keys(b.rpc).filter((k) => typeof (b.rpc as unknown as Record<string, unknown>)[k] === 'function').map((k) => vi.spyOn(b.rpc as never, k as never));
    const writes = [vi.spyOn(b, 'insert'), vi.spyOn(b, 'update')];
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const rem = vi.spyOn(Storage.prototype, 'removeItem');
    fireEvent.click(cards.find((c) => c.getAttribute('data-id') === 'occ-power-plant-cro')!);
    const results = await screen.findByTestId('m18-fs34-results', {}, T);
    const items = within(results).getAllByTestId('m18-fs34-result');
    expect(items).toHaveLength(5);
    expect(items[0].getAttribute('data-role')).toBe('local-operator');
    expect(within(items[0]).getByTestId('m18-fs34-gaps').querySelectorAll('li').length).toBeGreaterThan(0);
    const route = within(items[0]).getByTestId('m18-fs34-bridge');
    expect(route.querySelector('li')!.getAttribute('data-kind')).toBe('crossover');
    expect(within(items[0]).getAllByTestId('m18-fs34-item-why').length).toBe(route.querySelectorAll('li').length);
    expect(screen.getByTestId('m18-fs34-bring').querySelectorAll('tbody tr').length).toBeGreaterThanOrEqual(6);
    // the reasons open in place
    fireEvent.click(within(items[0]).getByTestId('m18-fs34-why'));
    expect(within(items[0]).getByTestId('m18-fs34-why-panel').textContent).toMatch(/cover/);
    expect(rpcSpies.every((s) => s.mock.calls.length === 0)).toBe(true);
    expect(writes.every((s) => s.mock.calls.length === 0)).toBe(true);
    expect(set).not.toHaveBeenCalled();
    expect(rem).not.toHaveBeenCalled();
    [...rpcSpies, ...writes, set, rem].forEach((s) => s.mockRestore());
  }, 60000);

  it('staff see a "my passport" tab that runs the same rule on their own skills', async () => {
    await renderPage(<CareersTranslatePage />, { path: '/careers/translate', persona: 'k-ro' });
    fireEvent.click(await screen.findByRole('tab', { name: en.fs34.tab.passport }, T));
    const tab = await screen.findByTestId('m18-fs34-passport', {}, T);
    await within(tab).findByTestId('m18-fs34-results', {}, T);
    expect(within(tab).getByTestId('m18-fs34-held').textContent).toMatch(/\d+/);
    expect(within(tab).getAllByTestId('m18-fs34-result').some((r) => r.getAttribute('data-role') === 'reactor-operator')).toBe(false);
  }, 60000);

  it('renders in Arabic', async () => {
    await renderPage(<CareersTranslatePage />, { path: '/ar/careers/translate', persona: null });
    const list = await screen.findByTestId('m18-fs34-occupations', {}, T);
    expect(screen.getByText(ar.fs34.pickTitle)).toBeTruthy();
    fireEvent.click(within(list).getAllByTestId('m18-fs34-occupation')[0]);
    await screen.findByTestId('m18-fs34-results', {}, T);
    expect(screen.getByText(ar.fs34.resultsTitle)).toBeTruthy();
  }, 60000);
});

describe('/my/career/health (FS35)', () => {
  it('Assess shows all five components with inputs and no hidden score; Chart saves a plan; Execute books the conversation through rpc.submitPrep', async () => {
    await renderPage(<MyCareerHealthPage />, { path: '/my/career/health', persona: 'k-ro' });
    const comps = await screen.findByTestId('m18-fs35-components', {}, T);
    const tiles = within(comps).getAllByTestId('m18-fs35-component');
    expect(tiles.map((x) => x.getAttribute('data-key'))).toEqual(['currency', 'breadth', 'recency', 'mobility', 'change']);
    for (const tile of tiles) {
      expect(tile.querySelectorAll('dt, dd, tr, li').length).toBeGreaterThan(0);
      expect(within(tile).getByTestId('m18-fs35-why')).toBeTruthy();
    }
    expect(screen.getByTestId('m18-fs35-summary').textContent).toMatch(/of 5 in good shape/);
    expect(document.body.textContent).not.toMatch(/score:/i);
    expect(screen.getByTestId('m18-fs35-private').textContent).toBe(en.fs35.private);
    expect(screen.getByTestId('m18-fs35-history').querySelectorAll('tbody tr').length).toBe(3);
    // Chart
    fireEvent.click(screen.getByTestId('m18-fs35-to-chart'));
    const actions = await screen.findByTestId('m18-fs35-actions', {}, T);
    expect(within(actions).getAllByRole('checkbox').length).toBe(6);
    const b = getLocalBackend();
    const save = vi.spyOn(b.rpc, 'saveHealthSnapshot');
    const prep = vi.spyOn(b.rpc, 'submitPrep');
    fireEvent.click(screen.getByTestId('m18-fs35-save'));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1), T);
    // Execute
    const goal = await screen.findByLabelText(new RegExp(en.fs35.goal), {}, T);
    fireEvent.change(goal, { target: { value: 'Prepare for the SRO route' } });
    fireEvent.click(screen.getByTestId('m18-fs35-book'));
    const dlg = await screen.findByRole('dialog', {}, T);
    fireEvent.click(within(dlg).getByRole('button', { name: en.fs35.book }));
    await screen.findByTestId('m18-fs35-done', {}, T);
    expect(prep).toHaveBeenCalledTimes(1);
    expect(prep.mock.calls[0][1]).toBe(true);
    expect(JSON.stringify(prep.mock.calls[0][0])).not.toMatch(/components|currency|"good"/);
    const convId = (await prep.mock.results[0].value).data.id;
    const snap = b.raw('health_snapshots').filter((s) => s.person_id === 'p-k-ro').find((s) => s.conversation_id === convId);
    expect(snap?.step).toBe('executed');
    expect(b.rawGet('career_conversations', convId)?.prep_submitted_at).toBeTruthy();
    save.mockRestore();
    prep.mockRestore();
  }, 90000);

  it('renders in Arabic', async () => {
    await renderPage(<MyCareerHealthPage />, { path: '/ar/my/career/health', persona: 'k-lo-trainee' });
    await screen.findByTestId('m18-fs35-components', {}, T);
    expect(screen.getByText(ar.fs35.assessTitle)).toBeTruthy();
    expect(screen.getAllByText(ar.fs35.comp.mobility).length).toBeGreaterThan(0);
  }, 60000);
});
