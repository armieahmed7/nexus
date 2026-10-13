// @vitest-environment jsdom
/** FS82 / FS83 pages (FS wave I · E4, M36) rendered with the real providers and the in-memory LocalBackend on a fixed clock (12 Oct 2026):
 *  my micro-grants (the open round, eligibility, my applications, the SIMULATED label), the programme figures (suppressed cells), the HR
 *  console (the HR director's decision through the RPC; the auditor reads only), the public consortium page (synthetic partners labelled,
 *  SIMULATED budget, secondary source flagged), the cohort workspace (a partner sees only its own trainees; the host queue and the
 *  on-behalf reference), my consortium place, and Arabic. Every page shows its FS82 / FS83 benchmark chips. */
import { afterAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import seed from '../../src/seed/seed.json';
import ar from '../../src/i18n/m36.ar.json';
import en from '../../src/i18n/m36.en.json';
import MyGrantsPage from '../../src/modules/m36/MyGrantsPage';
import GrantsProgrammePage from '../../src/modules/m36/GrantsProgrammePage';
import GrantsConsolePage from '../../src/modules/m36/GrantsConsolePage';
import ConsortiumPage from '../../src/modules/m36/ConsortiumPage';
import ConsortiumCohortPage from '../../src/modules/m36/ConsortiumCohortPage';
import MyConsortiumPage from '../../src/modules/m36/MyConsortiumPage';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const W = { timeout: 30000 };
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-12T08:00:00Z'));
afterAll(() => { vi.useRealTimers(); });
const chips = () => Array.from(document.querySelectorAll('button[data-testid^="benchmark-chip-"]')).map((x) => x.getAttribute('data-testid'));

describe('FS82 pages', () => {
  it('my micro-grants (nse): the round open to 10 Dec, eligibility with Why this?, my applications, SIMULATED label, FS82 chips', async () => {
    await renderPage(<MyGrantsPage />, { persona: 'nse', path: '/my/grants' });
    const my = await screen.findByTestId('m36-gr-my', {}, { timeout: 90000 });
    await waitFor(() => expect(within(screen.getByTestId('m36-gr-my')).queryAllByTestId('m36-gr-app').length).toBeGreaterThan(0), W); // the session restores the persona first
    expect(my.getAttribute('data-open')).toBe('gr-2026-12');
    expect(within(my).getByTestId('m36-gr-labels')).toBeTruthy();
    expect(within(my).getAllByTestId('m36-round').map((r) => r.getAttribute('data-phase'))).toEqual(['closed', 'closed', 'closed', 'open']);
    await waitFor(() => expect((within(screen.getByTestId('m36-gr-my')).getByTestId('m36-gr-apply') as HTMLButtonElement).disabled).toBe(false), W);
    const apps = within(screen.getByTestId('m36-gr-my')).getAllByTestId('m36-gr-app');
    expect(apps.length).toBe(T.grant_applications.filter((a) => a.person_id === 'p-nse').length);
    await waitFor(() => expect(chips()).toEqual(expect.arrayContaining(['benchmark-chip-NUC-NET'])), W);
  }, 150000);
  it('my micro-grants (qc-inspector): an approved grant with its output due offers "Log output"', async () => {
    await renderPage(<MyGrantsPage />, { persona: 'qc-inspector', path: '/my/grants' });
    await screen.findByTestId('m36-gr-my', {}, { timeout: 90000 });
    expect(await screen.findByTestId('m36-gr-log-output', {}, W)).toBeTruthy();
    expect(screen.getAllByTestId('m36-output-state').map((x) => x.getAttribute('data-state'))).toContain('due');
  }, 120000);
  it('programme figures (nse): tiles and rounds with suppressed cells; no person named', async () => {
    await renderPage(<GrantsProgrammePage />, { persona: 'nse', path: '/ecosystem/grants' });
    const g = await screen.findByTestId('m36-grp', {}, { timeout: 90000 });
    expect(within(g).getAllByTestId('m36-grp-round')).toHaveLength(4);
    expect(g.querySelectorAll('[data-suppressed="true"]').length).toBeGreaterThan(0);
    expect(g.textContent).not.toMatch(/p-nse|p-buyer/);
    expect(screen.queryByTestId('m36-grp-to-console')).toBeNull();
    await waitFor(() => expect(chips()).toContain('benchmark-chip-NUC-NET'), W);
  }, 120000);
  it('HR console (chco): the closed round with its SIMULATED budget meter; approving goes through decideGrant after a confirmation', async () => {
    const b = getLocalBackend();
    await renderPage(<GrantsConsolePage />, { persona: 'chco', path: '/workforce/grants' });
    const c = await screen.findByTestId('m36-grh', {}, { timeout: 90000 });
    expect(c.getAttribute('data-director')).toBe('yes');
    const meters = within(c).getAllByTestId('m36-grh-budget');
    expect(meters.map((m) => m.getAttribute('data-round'))).toEqual(['gr-2026-10', 'gr-2026-12']);
    expect(within(c).getByTestId('m36-grh-after-deadline')).toBeTruthy();
    const cards = within(c).getAllByTestId('m36-grh-app');
    expect(cards.length).toBe(T.grant_applications.filter((a) => a.round_id === 'gr-2026-10' && a.status === 'submitted').length + T.grant_applications.filter((a) => a.round_id === 'gr-2026-12' && a.status === 'submitted').length);
    const first = cards.find((x) => x.getAttribute('data-id') === 'ga-2026-10-01')!;
    const spy = vi.spyOn(b.rpc, 'decideGrant');
    fireEvent.click(within(first).getByTestId('m36-grh-approve'));
    await waitFor(() => expect(screen.getAllByRole('button', { name: en.grh.approve }).length).toBeGreaterThan(1), W);
    fireEvent.click(screen.getAllByRole('button', { name: en.grh.approve }).at(-1)!);
    await waitFor(() => expect(spy).toHaveBeenCalled(), W);
    expect((await spy.mock.results[0].value).data).toMatchObject({ status: 'approved' });
    spy.mockRestore();
    // the open round's applications show but cannot be decided before the deadline
    const open = cards.find((x) => x.getAttribute('data-id') === 'ga-2026-12-02')!;
    expect(within(open).queryByTestId('m36-grh-approve')).toBeNull();
  }, 150000);
  it('HR console (auditor): read only, no decision buttons', async () => {
    await renderPage(<GrantsConsolePage />, { persona: 'k-auditor', path: '/workforce/grants' });
    const c = await screen.findByTestId('m36-grh', {}, { timeout: 90000 });
    expect(c.getAttribute('data-director')).toBe('no');
    expect(within(c).getByText(en.grh.readOnlyTitle)).toBeTruthy();
    expect(within(c).queryByTestId('m36-grh-approve')).toBeNull();
  }, 120000);
});

describe('FS83 pages', () => {
  it('public consortium page (anonymous): synthetic partners labelled, SIMULATED budget, secondary source flagged, no figures, FS83 chips', async () => {
    await renderPage(<ConsortiumPage />, { persona: null, path: '/ecosystem/consortium' });
    const cc = await screen.findByTestId('m36-cc', {}, { timeout: 90000 });
    expect(within(cc).getByTestId('m36-cc-labels')).toBeTruthy();
    const cohort = within(cc).getByTestId('m36-cc-cohort');
    expect(cohort.getAttribute('data-id')).toBe('cc-2026');
    const partners = within(cohort).getAllByTestId('m36-cc-partner');
    expect(partners).toHaveLength(6);
    expect(partners.filter((p) => p.getAttribute('data-synthetic') === 'yes')).toHaveLength(5);
    for (const p of partners.filter((x) => x.getAttribute('data-synthetic') === 'yes')) expect(within(p).getByText(en.cc.syntheticChip)).toBeTruthy();
    expect(within(cohort).getByTestId('m36-cc-budget').getAttribute('data-simulated')).toBe('yes');
    expect(within(cohort).getAllByTestId('m36-cc-module')).toHaveLength(6);
    expect(within(cohort).getByTestId('m36-cc-sources').querySelectorAll('[data-secondary="yes"]')).toHaveLength(1);
    expect(screen.queryByTestId('m36-cc-figures')).toBeNull();
    expect(screen.queryByTestId('m36-cc-to-cohort')).toBeNull();
    await waitFor(() => expect(chips()).toEqual(expect.arrayContaining(['benchmark-chip-NUC-NET', 'benchmark-chip-UAE-PEERS'])), W);
  }, 150000);
  it('cohort workspace (alnoor-gm): only Al Noor\'s trainees and visits; the host queue lists visits to Al Noor', async () => {
    await renderPage(<ConsortiumCohortPage />, { persona: 'alnoor-gm', path: '/ecosystem/consortium/cc-2026', route: '/ecosystem/consortium/:id' });
    const ws = await screen.findByTestId('m36-ccw', {}, { timeout: 90000 });
    expect(ws.getAttribute('data-scope')).toBe('org');
    const rows = within(ws).getAllByTestId('m36-ccw-member');
    expect(rows.length).toBe(T.consortium_members.filter((m) => m.cohort_id === 'cc-2026' && m.org_id === 'org-alnoor').length);
    expect(rows.every((r) => r.getAttribute('data-org') === 'org-alnoor')).toBe(true);
    fireEvent.click(screen.getByRole('tab', { name: /Host queue/ }));
    const host = await screen.findByTestId('m36-ccw-host', {}, W);
    const waiting = within(host).getAllByTestId('m36-ccw-host-visit');
    expect(waiting.length).toBe(T.consortium_visits.filter((v) => v.cohort_id === 'cc-2026' && v.host_org_id === 'org-alnoor' && v.status === 'logged').length);
    expect(waiting.every((x) => x.getAttribute('data-route') === 'host')).toBe(true);
    await waitFor(() => expect(chips()).toContain('benchmark-chip-UAE-PEERS'), W);
  }, 150000);
  it('cohort workspace (chco): every trainee; confirming for a host without Kafa\'a access needs the host\'s reference', async () => {
    const b = getLocalBackend();
    await renderPage(<ConsortiumCohortPage />, { persona: 'chco', path: '/ecosystem/consortium/cc-2026', route: '/ecosystem/consortium/:id' });
    const ws = await screen.findByTestId('m36-ccw', {}, { timeout: 90000 });
    expect(ws.getAttribute('data-scope')).toBe('all');
    fireEvent.click(screen.getByRole('tab', { name: /Host queue/ }));
    const host = await screen.findByTestId('m36-ccw-host', {}, W);
    const card = within(host).getAllByTestId('m36-ccw-host-visit').find((x) => x.getAttribute('data-id') === 'cv-cc-2026-033')!;
    expect(card.getAttribute('data-route')).toBe('on_behalf');
    const btn = within(card).getByTestId('m36-ccw-confirm') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(within(card).getByLabelText(en.ccw.hostRef), { target: { value: 'SGS-HOST-CONF-2026-10-09' } });
    await waitFor(() => expect(btn.disabled).toBe(false), W);
    const spy = vi.spyOn(b.rpc, 'confirmConsortiumVisit');
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getAllByRole('button', { name: en.ccw.confirm }).length).toBeGreaterThan(1), W);
    fireEvent.click(screen.getAllByRole('button', { name: en.ccw.confirm }).at(-1)!);
    await waitFor(() => expect(spy).toHaveBeenCalled(), W);
    expect((await spy.mock.results[0].value).data).toMatchObject({ status: 'confirmed', profile_evidence: true });
    spy.mockRestore();
  }, 150000);
  it('my consortium place (k-lo-trainee): code, mentor from another employer, team, modules and my visits', async () => {
    await renderPage(<MyConsortiumPage />, { persona: 'k-lo-trainee', path: '/my/consortium' });
    const my = await screen.findByTestId('m36-ccm', {}, { timeout: 90000 });
    const place = within(my).getByTestId('m36-ccm-place');
    expect(place.getAttribute('data-status')).toBe('accepted');
    expect(within(place).getByTestId('m36-ccm-code').textContent).toBe('EN-26-01');
    expect(within(place).getAllByTestId('m36-cc-module')).toHaveLength(6);
    expect(within(place).getAllByTestId('m36-ccm-visit').length).toBe(T.consortium_visits.filter((v) => v.person_id === 'p-k-lo-trainee').length);
    expect(within(place).getByTestId('m36-ccw-log')).toBeTruthy();
    await waitFor(() => expect(chips()).toContain('benchmark-chip-NUC-NET'), W);
  }, 150000);
  it('renders the public consortium page in Arabic', async () => {
    await renderPage(<ConsortiumPage />, { persona: null, path: '/ar/ecosystem/consortium' });
    await screen.findByTestId('m36-cc', {}, { timeout: 90000 });
    expect(screen.getByText(ar.routes['ecosystem-consortium'].title, { selector: 'h1' })).toBeTruthy();
    expect(screen.getAllByText(ar.cc.syntheticChip).length).toBeGreaterThan(0);
  }, 150000);
  it('renders my micro-grants in Arabic', async () => {
    await renderPage(<MyGrantsPage />, { persona: 'nse', path: '/ar/my/grants' });
    await screen.findByTestId('m36-gr-my', {}, { timeout: 90000 });
    expect(screen.getByText(ar.routes['my-grants'].title, { selector: 'h1' })).toBeTruthy();
  }, 150000);
});
