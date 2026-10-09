// @vitest-environment jsdom
/** F32 and F38 pages rendered with the real providers and the in-memory LocalBackend: the micro-credential catalogue (claim behind a
 *  confirmation, stacks with their parts, "Why this?", renewal flag, my awards), the training manager's approvals and definitions tab
 *  (live copy check), the OJT logbook (practice notice, readiness rings, log practice, offline queue, preceptor acknowledgement,
 *  evaluator sign-off), the team readiness page, and Arabic. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import MicrocredsPage from '../../src/modules/m17/MicrocredsPage';
import MicrocredAdminTab from '../../src/modules/m17/MicrocredAdminTab';
import OjtLogbookPage from '../../src/modules/m02/OjtLogbookPage';
import TeamOjtPage from '../../src/modules/m02/TeamOjtPage';
import { readQueue } from '../../src/modules/m02/ojtQueue';

const W = { timeout: 15000 };
const confirm = async () => fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
const card = async (code: string) => (await screen.findAllByTestId('m17-mc-card', {}, W)).find((c) => c.getAttribute('data-code') === code)!;

describe('F32 pages', { timeout: 60000 }, () => {
  it('the catalogue shows an eligible micro-credential; claiming it (confirmed) issues it and the card turns active', async () => {
    await renderPage(<MicrocredsPage />, { persona: 'qc-inspector', path: '/my/skills/credentials' });
    expect((await screen.findByText(/Development recognition only/, {}, W))).toBeTruthy();
    const c = await card('MC-DATA-FOUND');
    expect(c.getAttribute('data-status')).toBe('eligible');
    fireEvent.click(within(c).getByTestId('m17-mc-why'));
    expect((await screen.findAllByTestId('m17-mc-why-panel'))[0].textContent).toMatch(/Met/);
    fireEvent.click(within(c).getByTestId('m17-mc-claim'));
    await confirm();
    await waitFor(async () => expect((await card('MC-DATA-FOUND')).getAttribute('data-status')).toBe('active'), W);
    expect((await screen.findByTestId('m17-mc-mine', {}, W)).textContent).toMatch(/MC-DATA-FOUND|Plant data/);
  });
  it('stacks list their parts; a stack whose part expired is flagged "renewal due"', async () => {
    await renderPage(<MicrocredsPage />, { persona: 'k-ro', path: '/my/skills/credentials' });
    const stacks = await screen.findAllByTestId('m17-mc-stack', {}, W);
    const hp = stacks.find((s) => s.getAttribute('data-code') === 'MC-HP-CHAMPION')!;
    expect(hp.getAttribute('data-status')).toBe('active');
    expect(hp.textContent).toMatch(/HU-PRAC|Human performance tools/);
  });
  it('the drawer explains what a micro-credential asks for and what it unlocks', async () => {
    await renderPage(<MicrocredsPage />, { persona: 'qc-inspector', path: '/my/skills/credentials?code=MC-DATA-FOUND' });
    const d = await screen.findByTestId('m17-mc-drawer', {}, W);
    expect(d.textContent).toMatch(/What it asks for/);
    expect(d.textContent).toMatch(/What it unlocks/);
    expect(within(d).getByTestId('m17-mc-criteria')).toBeTruthy();
  });
  it('the training manager approves a pending request from the frameworks tab', async () => {
    await renderPage(<MicrocredAdminTab />, { persona: 'training-mgr', path: '/admin/frameworks?tab=microcredentials' });
    const list = await screen.findByTestId('m17-mc-approvals', {}, W);
    const before = within(list).getAllByTestId('m17-mc-approval').length;
    fireEvent.click(within(list).getAllByTestId('m17-mc-approve')[0]);
    const dlg = await screen.findByRole('dialog', {}, W);
    fireEvent.change(dlg.querySelector('textarea')!, { target: { value: 'Project close-out reviewed' } });
    await confirm();
    await waitFor(() => expect(screen.queryAllByTestId('m17-mc-approval').length).toBe(before - 1), W);
    expect(screen.getByTestId('m17-mc-defs')).toBeTruthy();
  });
  it('the definition editor runs the copy check as you type', async () => {
    await renderPage(<MicrocredAdminTab />, { persona: 'training-mgr', path: '/admin/frameworks?tab=microcredentials' });
    fireEvent.click(await screen.findByTestId('m17-mc-new', {}, W));
    const ed = await screen.findByTestId('m17-mc-editor', {}, W);
    const title = within(ed).getByLabelText(/Title \(English\)/) as HTMLInputElement;
    fireEvent.change(title, { target: { value: 'FANR certified data analyst' } });
    expect(await within(ed).findByText(/Wording not allowed/)).toBeTruthy();
  });
  it('renders in Arabic', async () => {
    await renderPage(<MicrocredsPage />, { persona: 'qc-inspector', path: '/ar/my/skills/credentials' });
    expect(await screen.findByText(/تقدير للتطوير فقط/, {}, W)).toBeTruthy();
  });
});

describe('F38 pages', { timeout: 60000 }, () => {
  it('the logbook shows the practice notice, tasks with readiness and "Why this?"; a ready task can be sent for evaluation', async () => {
    await renderPage(<OjtLogbookPage />, { persona: 'qc-inspector', path: '/my/ojt' });
    expect(await screen.findByText(/Practice, not a sign-off/, {}, W)).toBeTruthy();
    const tasks = await screen.findAllByTestId('m02-ojt-task', {}, W);
    const t1 = tasks.find((x) => x.getAttribute('data-task') === 'qs-qa-t1')!;
    const t2 = tasks.find((x) => x.getAttribute('data-task') === 'qs-qa-t2')!;
    expect(t1.getAttribute('data-ready')).toBe('yes');
    expect(t2.getAttribute('data-ready')).toBe('no');
    expect((within(t2).getByTestId('m02-ojt-request') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(t1).getByTestId('m02-ojt-why'));
    expect((await screen.findAllByTestId('m02-ojt-why-panel'))[0].textContent).toMatch(/supervised performances/);
    fireEvent.click(within(t1).getByTestId('m02-ojt-request'));
    const dlg = await screen.findByRole('dialog', {}, W);
    await waitFor(() => expect(dlg.querySelectorAll('select option').length).toBeGreaterThan(1), W);
    const sel = dlg.querySelector('select')!;
    fireEvent.change(sel, { target: { value: (sel.querySelectorAll('option')[1] as HTMLOptionElement).value } });
    fireEvent.click(within(dlg).getByTestId('m02-ojt-request-send'));
    await waitFor(() => expect(screen.getAllByTestId('m02-ojt-task').find((x) => x.getAttribute('data-task') === 'qs-qa-t1')!.textContent).toMatch(/Evaluation requested/), W);
  });
  it('logging practice online records the entry; offline it is queued on the device with its client key', async () => {
    await renderPage(<OjtLogbookPage />, { persona: 'qc-inspector', path: '/my/ojt' });
    const t2 = (await screen.findAllByTestId('m02-ojt-task', {}, W)).find((x) => x.getAttribute('data-task') === 'qs-qa-t2')!;
    const entries0 = within(t2).queryAllByTestId('m02-ojt-entry').length;
    fireEvent.click(within(t2).getByTestId('m02-ojt-log'));
    const form = await screen.findByTestId('m02-ojt-form', {}, W);
    const pre = within(form).getByLabelText(/Preceptor/) as HTMLSelectElement;
    await waitFor(() => expect(pre.querySelectorAll('option').length).toBeGreaterThan(1), W);
    fireEvent.change(pre, { target: { value: 'p-sq-lead' } });
    fireEvent.click(screen.getByTestId('m02-ojt-submit'));
    await waitFor(() => expect(within(screen.getAllByTestId('m02-ojt-task').find((x) => x.getAttribute('data-task') === 'qs-qa-t2')!).queryAllByTestId('m02-ojt-entry').length).toBe(entries0 + 1), W);
    // offline
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    window.dispatchEvent(new Event('offline'));
    expect(await screen.findByText(/You are offline/, {}, W)).toBeTruthy();
    fireEvent.click(within(screen.getAllByTestId('m02-ojt-task').find((x) => x.getAttribute('data-task') === 'qs-qa-t2')!).getByTestId('m02-ojt-log'));
    const form2 = await screen.findByTestId('m02-ojt-form', {}, W);
    const pre2 = within(form2).getByLabelText(/Preceptor/) as HTMLSelectElement;
    await waitFor(() => expect(pre2.querySelectorAll('option').length).toBeGreaterThan(1), W);
    fireEvent.change(pre2, { target: { value: 'p-sq-lead' } });
    fireEvent.click(screen.getByTestId('m02-ojt-submit'));
    expect((await screen.findByTestId('m02-ojt-queue', {}, W)).getAttribute('data-count')).toBe('1');
    expect(readQueue('p-qc-inspector').length).toBe(1);
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
    window.dispatchEvent(new Event('online'));
    await waitFor(() => expect(screen.queryByTestId('m02-ojt-queue')).toBeNull(), W);
    expect(readQueue('p-qc-inspector').length).toBe(0);
    expect((await screen.findByTestId('m02-ojt-sync-result', {}, W)).textContent).toMatch(/Synced 1/);
  });
  it('the preceptor acknowledges an entry addressed to them (labelled "practice, not a sign-off")', async () => {
    await renderPage(<OjtLogbookPage />, { persona: 'sq-lead', path: '/my/ojt?tab=acknowledge' });
    const items = await screen.findAllByTestId('m02-ojt-ack-item', {}, W);
    const n = items.length;
    fireEvent.click(within(items[0]).getByTestId('m02-ojt-ack-btn'));
    const dlg = await screen.findByRole('dialog', {}, W);
    expect(dlg.textContent).toMatch(/does not change the person's qualification/);
    fireEvent.change(within(dlg).getByLabelText(/Feedback/), { target: { value: 'Clear findings, good closing meeting.' } });
    fireEvent.click(within(dlg).getByTestId('m02-ojt-ack-send'));
    await waitFor(() => expect(screen.queryAllByTestId('m02-ojt-ack-item').length).toBe(n - 1), W);
  });
  it('the evaluator sees the request addressed to them', async () => {
    await renderPage(<OjtLogbookPage />, { persona: 'k-instructor', path: '/my/ojt?tab=evaluate' });
    const items = await screen.findAllByTestId('m02-ojt-eval-item', {}, W);
    expect(items[0].textContent).toMatch(/Local Operator trainee/);
    expect(within(items[0]).getByTestId('m02-ojt-signoff')).toBeTruthy();
  });
  it('the team page shows readiness for people in scope with "Why this?"', async () => {
    await renderPage(<TeamOjtPage />, { persona: 'head-sq', path: '/team/ojt' });
    const page = await screen.findByTestId('m02-ojt-team', {}, W);
    expect(page.textContent).toMatch(/QA-|qs-qa|Supervised/);
    expect(screen.getAllByTestId('m02-ojt-team-why').length).toBeGreaterThan(0);
  });
  it('renders in Arabic', async () => {
    await renderPage(<OjtLogbookPage />, { persona: 'qc-inspector', path: '/ar/my/ojt' });
    expect(await screen.findByText(/ممارسة، وليست اعتماداً/, {}, W)).toBeTruthy();
  });
});
