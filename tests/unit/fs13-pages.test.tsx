// @vitest-environment jsdom
/** [FS wave A · E3 · FS04] Pages: /workforce/future shows the computed radar (suppressed cells, sourced scenario assumptions, family
 *  heatmap, benchmark chips, "Why this?") in EN and AR, the scenario switch changes demand; /workforce/future/keyspace shows full
 *  coverage and lets an admin edit a key through the audited RPC. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import WorkforceFuturePage from '../../src/modules/m11/WorkforceFuturePage';
import KeyspacePage from '../../src/modules/m11/KeyspacePage';
import { routes } from '../../src/modules/m11/routes';
import en from '../../src/i18n/m11.en.json';
import ar from '../../src/i18n/m11.ar.json';

describe('/workforce/future (FS04 computed radar)', () => {
  it('shows computed readiness with suppressed cells, sourced assumptions, the family heatmap and both benchmarks', async () => {
    await renderPage(<WorkforceFuturePage />, { persona: 'k-hr-analyst', path: '/workforce/future' });
    await waitFor(() => expect(screen.getByTestId('m11-suppressed-salt-chemistry')).toBeTruthy());
    expect(screen.getByTestId('m11-bench-IAEA-WFP')).toBeTruthy();
    expect(screen.getByTestId('m11-bench-ESCO')).toBeTruthy();
    expect(screen.getAllByTestId('heatmap').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m11-assumptions').textContent).toContain('SIMULATED');
    expect(screen.getAllByTestId(/^m11-why-/).length).toBe(8);
    expect(document.body.textContent).toContain(en.wf.statPopulation);
    expect(screen.getByTestId('m11-no-decision')).toBeTruthy();
  });
  it('switching to Scenario B changes the demand shown', async () => {
    await renderPage(<WorkforceFuturePage />, { persona: 'chco', path: '/workforce/future' });
    await waitFor(() => expect(screen.getByTestId('m11-assumptions')).toBeTruthy());
    const before = screen.getByTestId('m11-assumptions').textContent;
    fireEvent.click(screen.getByTestId('m11-scenario-b'));
    await waitFor(() => expect(screen.getByTestId('m11-assumptions').textContent).not.toBe(before));
    expect(screen.getByTestId('m11-assumptions').textContent).toContain('light-water SMR');
  });
  it('renders in Arabic', async () => {
    await renderPage(<WorkforceFuturePage />, { persona: 'k-hr-analyst', path: '/ar/workforce/future' });
    await waitFor(() => expect(screen.getByTestId('m11-assumptions')).toBeTruthy());
    expect(document.body.textContent).toContain(ar.wf.familyTitle);
    expect(document.body.textContent).toContain(ar.bench.follows);
  });
});

describe('/workforce/future/keyspace (FS04 keyspace)', () => {
  it('is registered for HR, auditors and admins under the radar', () => {
    const r = routes.find((x) => x.id === 'workforce-future-keyspace')!;
    expect(r.path).toBe('/workforce/future/keyspace');
    expect(r.parent).toBe('workforce-future');
    expect(r.guard).toMatchObject({ signedIn: true, anyRole: ['hr_analyst', 'hr_director', 'auditor', 'admin'] });
  });
  it('shows every ADVANCE and radar key resolved, in EN and AR', async () => {
    await renderPage(<KeyspacePage />, { persona: 'k-hr-analyst', path: '/workforce/future/keyspace' });
    await waitFor(() => expect(document.body.textContent).toContain(en.ks.allResolved));
    expect(document.body.textContent).toContain('27 / 27');
    expect(document.body.textContent).toContain('8 / 8');
    expect(screen.queryAllByTestId(/^m11-ks-edit-/)).toHaveLength(0); // HR reads; only admins edit
    await renderPage(<KeyspacePage />, { persona: 'k-hr-analyst', path: '/ar/workforce/future/keyspace' });
    await waitFor(() => expect(document.body.textContent).toContain(ar.ks.allResolved));
  });
  it('an admin edits a key through the audited RPC', async () => {
    await renderPage(<KeyspacePage />, { persona: 'k-admin', path: '/workforce/future/keyspace' });
    await waitFor(() => expect(screen.getAllByTestId(/^m11-ks-edit-/).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByTestId(/^m11-ks-edit-/)[0]);
    await waitFor(() => expect(screen.getByTestId('m11-ks-form')).toBeTruthy());
    fireEvent.click(screen.getByTestId('m11-ks-save'));
    const confirm = await screen.findByTestId('confirm-action');
    for (const box of Array.from(document.querySelectorAll('[role="dialog"] input[type="checkbox"]'))) if (!(box as HTMLInputElement).checked) fireEvent.click(box);
    fireEvent.click(confirm);
    await waitFor(() => expect(getLocalBackend().raw('audit_events').some((e) => e.action === 'future.map' && e.outcome === 'ok')).toBe(true));
  });
});
