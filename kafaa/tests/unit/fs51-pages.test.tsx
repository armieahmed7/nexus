// @vitest-environment jsdom
/** FS38 / FS39 / FS40 pages (FS wave E · E1, M31) rendered with the real providers and the in-memory LocalBackend: the public SMR delta
 *  grid (anonymous, EN and AR), my delta with readiness and reasons, the HR matrix with suppression, the delta editor; the plant
 *  explainer offline (acceptance FS39-1: no fetch, no RPC, no repository read or write, no storage while walking every scenario) with the
 *  SIMULATED chip on every screen (FS39-3); the plant log with host confirmation; a twin drill end to end and the drill bank. Every page
 *  shows its benchmark chips. */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import seed from '../../src/seed/seed.json';
import en from '../../src/i18n/m31.en.json';
import ar from '../../src/i18n/m31.ar.json';
import common from '../../src/i18n/common.en.json';
import CareersNextGenPage from '../../src/modules/m31/CareersNextGenPage';
import MyNextGenPage from '../../src/modules/m31/MyNextGenPage';
import WorkforceNextGenPage from '../../src/modules/m31/WorkforceNextGenPage';
import AdminNextGenPage from '../../src/modules/m31/AdminNextGenPage';
import PlantLiteracyPage from '../../src/modules/m31/PlantLiteracyPage';
import PlantLogPage from '../../src/modules/m31/PlantLogPage';
import TwinDrillsPage from '../../src/modules/m31/TwinDrillsPage';
import TwinDrillPage from '../../src/modules/m31/TwinDrillPage';
import TrainingTwinDrillsPage from '../../src/modules/m31/TrainingTwinDrillsPage';
import { SCENARIOS } from '../../src/modules/m31/plantModel';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const W = { timeout: 30000 };
const chips = () => Array.from(document.querySelectorAll('button[data-testid^="benchmark-chip-"]')).map((x) => x.getAttribute('data-testid'));

describe('FS38 pages', () => {
  it('anonymous: the public grid shows all 28 current roles x 6 families, a delta with sources and the planning note (FS38 chips)', async () => {
    await renderPage(<CareersNextGenPage />, { persona: null, path: '/careers/next-gen?role=reactor-operator' });
    const grid = await screen.findByTestId('m31-grid', {}, { timeout: 90000 });
    expect(within(grid).getAllByTestId('m31-grid-role')).toHaveLength(28);
    expect(within(grid).getAllByTestId('m31-grid-cell').length).toBe(T.smr_deltas.filter((d) => d.status === 'published').length);
    const delta = await screen.findByTestId('m31-delta', {}, W);
    expect(delta.getAttribute('data-id')).toMatch(/^smrd:reactor-operator:/);
    expect(within(delta).getByTestId('m31-sources').querySelectorAll('a').length).toBeGreaterThanOrEqual(2);
    expect(within(delta).getAllByTestId('m31-dims')[0].querySelectorAll('li')).toHaveLength(7);
    expect(screen.getAllByTestId('m31-no-deploy')[0].textContent).toMatch(/no deployment decision is implied/);
    await waitFor(() => expect(chips()).toEqual(expect.arrayContaining(['benchmark-chip-SMR-WF', 'benchmark-chip-IAEA-WFP'])), W);
    fireEvent.click(within(grid).getAllByTestId('m31-grid-cell').find((c) => c.getAttribute('data-role') === 'security-officer')!);
    await waitFor(() => expect(screen.getByTestId('m31-delta').getAttribute('data-path-only')).toBe('yes'), W);
    expect(screen.getByTestId('m31-path-only')).toBeTruthy();
  }, 150000);
  it('renders in Arabic', async () => {
    await renderPage(<CareersNextGenPage />, { persona: null, path: '/ar/careers/next-gen' });
    await screen.findByTestId('m31-grid', {}, W);
    expect(screen.getByText(ar.pub.gridTitle, { selector: 'h2' })).toBeTruthy();
    expect(screen.getAllByTestId('m31-no-deploy')[0].textContent).toContain(ar.ng.noDeploy);
  }, 60000);
  it('staff: my delta for my current role, with tabs per family, readiness, needs vs my levels, reasons and closing training', async () => {
    await renderPage(<MyNextGenPage />, { persona: 'k-ro', path: '/my/next-gen' });
    const my = await screen.findByTestId('m31-my', {}, W);
    expect(my.getAttribute('data-mine')).toBe('yes');
    expect(my.getAttribute('data-role')).toBe('reactor-operator');
    expect(within(my).getByTestId('m31-my-label').textContent).toBe(en.my.myRole);
    expect(within(my).getAllByTestId('m31-tech-tab').length).toBeGreaterThanOrEqual(3);
    const panel = within(my).getByTestId('m31-panel');
    expect(Number(panel.getAttribute('data-readiness'))).toBeGreaterThanOrEqual(0);
    expect(within(panel).getByTestId('m31-needs').querySelectorAll('tbody tr').length).toBeGreaterThan(0);
    fireEvent.click(within(panel).getByTestId('m31-why'));
    expect(within(panel).getByTestId('m31-why-panel').textContent).toMatch(/Readiness/);
    expect(within(panel).getByTestId('m31-close').querySelectorAll('li').length).toBeGreaterThan(0);
    // concept roles appear only as related concepts, never as my role
    const options = Array.from(screen.getByLabelText(en.my.roleLabel).querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value).filter(Boolean);
    expect(options).toHaveLength(28);
    expect(options.some((o) => o.startsWith('fr-'))).toBe(false);
    await waitFor(() => expect(chips()).toContain('benchmark-chip-SMR-WF'), W);
  }, 90000);
  it('HR: the matrix per technology family with the 10-person rule; staff are told the view is for HR', async () => {
    await renderPage(<WorkforceNextGenPage />, { persona: 'chco', path: '/workforce/next-gen' });
    const techs = await screen.findByTestId('m31-wf-techs', {}, W);
    expect(techs.querySelectorAll('li[data-tech]')).toHaveLength(6);
    expect(techs.querySelectorAll('li[data-suppressed="no"]').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m31-wf-heat')).toBeTruthy();
    await renderPage(<WorkforceNextGenPage />, { persona: 'k-ro', path: '/workforce/next-gen' });
    expect(await screen.findByText(en.wf.noAccess, {}, W)).toBeTruthy();
  }, 90000);
  it('the delta editor runs the server check: a deployment claim blocks saving; a clean edit saves a new version', async () => {
    await renderPage(<AdminNextGenPage />, { persona: 'training-mgr', path: '/admin/next-gen' });
    await screen.findByTestId('m31-adm', {}, W);
    fireEvent.change(screen.getByPlaceholderText(common.filterRows), { target: { value: 'Microreactors' } });
    const row = await waitFor(() => { const r = screen.getAllByRole('row').find((x) => /Quality Assurance/.test(x.textContent ?? '') && /Microreactors/.test(x.textContent ?? '')); if (!r) throw new Error('row'); return r; }, W);
    fireEvent.click(row);
    const editor = await screen.findByTestId('m31-adm-editor', {}, W);
    expect(screen.getByTestId('m31-adm-check').getAttribute('data-problem')).toBe('');
    fireEvent.change(within(editor).getByLabelText(en.adm.changesEn), { target: { value: 'Construction will start in 2030.' } });
    expect(screen.getByTestId('m31-adm-check').getAttribute('data-problem')).toBe('unclean');
    expect((screen.getByTestId('m31-adm-save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(editor).getByLabelText(en.adm.changesEn), { target: { value: 'More units to supervise at once. Planning assumption; no deployment decision implied.' } });
    expect(screen.getByTestId('m31-adm-check').getAttribute('data-problem')).toBe('');
    const save = vi.spyOn(getLocalBackend().rpc, 'saveSmrDelta');
    fireEvent.click(screen.getByTestId('m31-adm-save'));
    fireEvent.click(await screen.findByRole('button', { name: /confirm/i }, W));
    await waitFor(() => expect(save).toHaveBeenCalled(), W);
    expect((await save.mock.results[0].value).ok).toBe(true);
    save.mockRestore();
  }, 90000);
});

describe('FS39 pages', () => {
  it('acceptance 1: the plant explainer runs offline: no fetch, no RPC, no repository read or write and no storage while walking every scenario; acceptance 3: the SIMULATED chip is on every screen', async () => {
    await renderPage(<PlantLiteracyPage />, { persona: 'buyer', path: '/learn/plant-literacy' });
    const list = await screen.findByTestId('m31-pl-scenarios', {}, W);
    await waitFor(() => expect(chips()).toEqual(expect.arrayContaining(['benchmark-chip-SMR-WF', 'benchmark-chip-NEA'])), W);
    const b = getLocalBackend();
    const rpcSpies = Object.keys(b.rpc).filter((k) => typeof (b.rpc as unknown as Record<string, unknown>)[k] === 'function').map((k) => vi.spyOn(b.rpc as never, k as never));
    const io = [vi.spyOn(b, 'insert'), vi.spyOn(b, 'update'), vi.spyOn(b, 'list'), vi.spyOn(b, 'get')];
    const fetchSpy = vi.fn(() => Promise.reject(new Error('offline')));
    const realFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as never;
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const rem = vi.spyOn(Storage.prototype, 'removeItem');
    const simChips = () => screen.getAllByText('SIMULATED').length;
    expect(simChips()).toBeGreaterThanOrEqual(SCENARIOS.length);
    let steps = 0;
    for (const s of SCENARIOS) {
      fireEvent.click(within(screen.getByTestId('m31-pl-scenarios')).getAllByTestId('m31-pl-start')[SCENARIOS.indexOf(s)]);
      for (let i = 0; i < s.steps.length; i++) {
        const player = await screen.findByTestId('m31-pl-player');
        expect(player.getAttribute('data-step')).toBe(s.steps[i].id);
        expect(simChips()).toBeGreaterThanOrEqual(2);
        expect(screen.getByTestId('m31-pl-schematic')).toBeTruthy();
        expect(screen.getByTestId('m31-pl-sim-note')).toBeTruthy();
        if (s.steps[i].question) {
          fireEvent.click(screen.getByTestId(`m31-pl-opt-${s.steps[i].question!.correct}`));
          expect(screen.getByTestId('m31-pl-feedback').getAttribute('data-right')).toBe('yes');
        }
        steps++;
        if (i < s.steps.length - 1) fireEvent.click(screen.getByTestId('m31-pl-next'));
      }
      if (s.link === 'next_gen') expect(screen.getByTestId('m31-pl-next-gen')).toBeTruthy();
      fireEvent.click(screen.getByTestId('m31-pl-done'));
      await screen.findByTestId('m31-pl-scenarios');
    }
    expect(steps).toBe(SCENARIOS.reduce((n, s) => n + s.steps.length, 0));
    expect(screen.getByTestId('m31-pl-score').textContent).toMatch(/right/);
    expect(list).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(rpcSpies.every((s) => s.mock.calls.length === 0)).toBe(true);
    expect(io.every((s) => s.mock.calls.length === 0)).toBe(true);
    expect(set).not.toHaveBeenCalled();
    expect(rem).not.toHaveBeenCalled();
    globalThis.fetch = realFetch;
    [...rpcSpies, ...io, set, rem].forEach((s) => s.mockRestore());
  }, 120000);
  it('the explainer renders in Arabic with the SIMULATED notice', async () => {
    await renderPage(<PlantLiteracyPage />, { persona: 'buyer', path: '/ar/learn/plant-literacy' });
    expect((await screen.findByTestId('m31-pl-sim', {}, W)).textContent).toBe(ar.pl.simBody);
  }, 60000);
  it('the plant log: I log a visit for my host (no evidence yet); the host confirms on the "To confirm" tab', async () => {
    await renderPage(<PlantLogPage />, { persona: 'buyer', path: '/my/plant-log' });
    const mine = await screen.findByTestId('m31-pv-mine', {}, W);
    expect(within(mine).getAllByTestId('m31-pv-row').length).toBe(T.plant_visits.filter((v) => v.person_id === 'p-buyer').length);
    fireEvent.click(screen.getByTestId('m31-pv-log'));
    const form = await screen.findByTestId('m31-pv-form', {}, W);
    expect(screen.getByTestId('m31-pv-check').getAttribute('data-problem')).toBe('host');
    const host = within(form).getByLabelText(en.pv.hostLabel) as HTMLSelectElement;
    await waitFor(() => expect(host.querySelectorAll('option').length).toBeGreaterThan(2), W);
    expect(Array.from(host.querySelectorAll('option')).some((o) => o.value === 'p-buyer')).toBe(false);
    fireEvent.change(host, { target: { value: 'p-k-instructor' } });
    fireEvent.change(within(form).getByLabelText(en.pv.noteLabel), { target: { value: 'mail me at a.b@example.org' } });
    expect(screen.getByTestId('m31-pv-check').getAttribute('data-problem')).toBe('note');
    fireEvent.change(within(form).getByLabelText(en.pv.noteLabel), { target: { value: 'Turbine hall walk-down.' } });
    expect(screen.getByTestId('m31-pv-check').getAttribute('data-problem')).toBe('');
    const b = getLocalBackend();
    const log = vi.spyOn(b.rpc, 'logVisit');
    fireEvent.click(screen.getByTestId('m31-pv-submit'));
    fireEvent.click(await screen.findByRole('button', { name: /confirm/i }, W));
    await waitFor(() => expect(log).toHaveBeenCalled(), W);
    const r = await log.mock.results[0].value;
    expect(r.ok).toBe(true);
    expect((b.raw('skill_evidence' as never) as unknown as Row[]).some((e) => e.ref_id === r.data.id)).toBe(false);
    log.mockRestore();
    await waitFor(() => expect(screen.getAllByTestId('m31-pv-row').some((x) => x.getAttribute('data-id') === r.data.id && x.getAttribute('data-status') === 'logged')).toBe(true), W);
  }, 90000);
  it('the host tab lists visits waiting for me; confirming writes the evidence (Arabic)', async () => {
    await renderPage(<PlantLogPage />, { persona: 'k-instructor', path: '/ar/my/plant-log?tab=host' });
    const host = await screen.findByTestId('m31-pv-host', {}, W);
    const waiting = T.plant_visits.filter((v) => v.host_person_id === 'p-k-instructor' && v.status === 'logged');
    expect(waiting.length).toBeGreaterThan(0);
    await waitFor(() => expect(within(host).getAllByTestId('m31-pv-confirm').length).toBe(waiting.length), W);
    fireEvent.click(within(host).getAllByTestId('m31-pv-confirm')[0]);
    const dialog = await screen.findByRole('dialog', {}, W);
    fireEvent.click(within(dialog).getAllByRole('button').pop()!);
    const b = getLocalBackend();
    await waitFor(() => expect((b.raw('skill_evidence' as never) as unknown as Row[]).some((e) => e.ref_table === 'plant_visits' && waiting.some((w) => w.id === e.ref_id))).toBe(true), W);
  }, 90000);
});

describe('FS40 pages', () => {
  it('the drills list: 4 open drills, SIMULATED notice, my status and the FS40 chips', async () => {
    await renderPage(<TwinDrillsPage />, { persona: 'qc-inspector', path: '/my/twin-drills' });
    const list = await screen.findByTestId('m31-tw-list', {}, W);
    expect(within(list).getAllByTestId('m31-tw-card')).toHaveLength(4);
    expect(within(list).getAllByTestId('m31-tw-card').some((c) => c.getAttribute('data-state') !== 'new')).toBe(true);
    expect(screen.getByTestId('m31-tw-synthetic').textContent).toMatch(/SIMULATED/);
    await waitFor(() => expect(chips()).toEqual(expect.arrayContaining(['benchmark-chip-IAEA-AI', 'benchmark-chip-SMR-WF'])), W);
  }, 90000);
  it('a drill end to end: trends with the model band, the check budget, diagnosis, action, confirm, scored result with capped evidence', async () => {
    const sc = T.twin_scenarios.find((s) => s.id === 'tw-fw-bearing')!;
    const k = T.twin_keys.find((x) => x.scenario_id === sc.id)!;
    await renderPage(<TwinDrillPage />, { persona: 'buyer', path: `/my/twin-drills/${sc.id}`, route: '/my/twin-drills/:id' });
    const trends = await screen.findByTestId('m31-twd-trends', {}, W);
    expect(trends.querySelectorAll('figure[data-signal]')).toHaveLength(sc.series.signals.length);
    expect(trends.querySelectorAll('table.sr-only').length).toBe(sc.series.signals.length);
    const checks = screen.getByTestId('m31-twd-checks');
    for (const id of k.useful_checks) fireEvent.click(within(checks.querySelector(`[data-check="${id}"]`) as HTMLElement).getByTestId('m31-twd-run'));
    expect(within(checks).getAllByTestId('m31-twd-result')).toHaveLength(k.useful_checks.length);
    expect(within(checks).queryAllByTestId('m31-twd-run').every((x) => (x as HTMLButtonElement).disabled)).toBe(k.useful_checks.length >= sc.max_checks);
    fireEvent.click(screen.getByTestId('m31-twd-next'));
    fireEvent.click(await screen.findByTestId(`m31-twd-component-${k.component_id}`));
    fireEvent.click(screen.getByTestId(`m31-twd-mode-${k.mode_id}`));
    fireEvent.click(screen.getByTestId('m31-twd-next2'));
    fireEvent.click(await screen.findByTestId(`m31-twd-action-${k.best_action}`));
    for (const r of k.sound_rationales) fireEvent.click(screen.getByTestId(`m31-twd-rat-${r}`));
    fireEvent.click(screen.getByTestId('m31-twd-submit'));
    fireEvent.click(await screen.findByRole('button', { name: /confirm/i }, W));
    const res = await screen.findByTestId('m31-twd-result', {}, W);
    expect(res.getAttribute('data-passed')).toBe('yes');
    expect(Number(res.getAttribute('data-level'))).toBe(sc.level);
    expect(Number(screen.getByTestId('m31-twd-evidence').getAttribute('data-level'))).toBeLessThanOrEqual(2);
    fireEvent.click(within(res).getByTestId('m31-twd-why'));
    expect(within(res).getByTestId('m31-twd-why-panel').textContent).toMatch(/component/);
  }, 120000);
  it('the drill bank for the training manager: results with suppression, every drill with its key, the editor check (Arabic)', async () => {
    await renderPage(<TrainingTwinDrillsPage />, { persona: 'training-mgr', path: '/ar/training/twin-drills' });
    const bank = await screen.findByTestId('m31-ttw-bank', {}, W);
    expect(bank.querySelectorAll('li[data-id]')).toHaveLength(5);
    expect(within(bank).getAllByTestId('m31-ttw-key')).toHaveLength(5);
    await waitFor(() => expect(screen.getByTestId('m31-ttw-tiles')).toBeTruthy(), W);
    fireEvent.click(within(bank).getAllByTestId('m31-ttw-copy')[0]);
    await screen.findByTestId('m31-ttw-editor', {}, W);
    expect(screen.getByTestId('m31-ttw-check').getAttribute('data-problem')).toBe('synthetic');
  }, 90000);
});
