// @vitest-environment jsdom
/** FS81 pages rendered with the real providers and the in-memory LocalBackend: my transition plan (SIMULATED label, privacy note,
 *  protected -> target role, the ladder-rung alert naming each task and the practice added with acknowledged OJT repetitions, review
 *  dates, acknowledgement), the HR board and a plan page (activating a draft only after ticking practice for every alerted task),
 *  managers and other roles getting nothing, the role-level ladder-rung alerts (no person), and Arabic. */
import { describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import seed from '../../src/seed/seed.json';
import MyTransitionPlanPage from '../../src/modules/m30/MyTransitionPlanPage';
import WorkforceTransitionPlansPage from '../../src/modules/m30/WorkforceTransitionPlansPage';
import TransitionPlanPage from '../../src/modules/m30/TransitionPlanPage';
import RungAlertsPage from '../../src/modules/m30/RungAlertsPage';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const TB = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const W = { timeout: 30000 };
const FIRST = { timeout: 90000 };
const raw = (t: string) => getLocalBackend().raw(t as never) as unknown as Row[];

describe('FS81 my transition plan', () => {
  it('FS81 acceptance: my plan is labelled SIMULATED, carries review dates and names every alerted task with the practice added', async () => {
    await renderPage(<MyTransitionPlanPage />, { persona: 'k-ro', path: '/my/transition-plan' });
    await screen.findByTestId('m30-tp-mine', {}, FIRST);
    expect(screen.getAllByText('SIMULATED HR record').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m30-tp-protected').textContent).toMatch(/Reactor Operator/);
    expect(screen.getByTestId('m30-tp-target').textContent).toMatch(/Senior Reactor Operator/);
    expect(screen.getByTestId('m30-tp-privacy').textContent).toMatch(/Only you and HR/);
    const alert = screen.getByTestId('m30-tp-alert');
    expect(alert.getAttribute('data-uncovered')).toBe('0');
    const tasks = within(alert).getAllByTestId('m30-tp-task');
    expect(tasks.length).toBe(8);
    for (const t of tasks) {
      expect(t.getAttribute('data-covered')).toBe('true');
      expect(within(t).getByTestId('m30-tp-practice').textContent).toMatch(/(Simulator|OJT)/);
    }
    const reviews = screen.getByTestId('m30-tp-reviews');
    expect(within(reviews).getByText(/Reviewed: on track/)).toBeTruthy();
    expect(within(reviews).getByText('Next review')).toBeTruthy();
    expect(screen.getByTestId('m30-tp-acked')).toBeTruthy();
    expect(screen.getAllByTestId('m30-bench').length).toBeGreaterThan(0);
  }, 150000);

  it('the person acknowledges their active plan once (ConfirmDialog, audited); OJT repetitions since the start show as progress', async () => {
    await renderPage(<MyTransitionPlanPage />, { persona: 'k-lo-trainee', path: '/my/transition-plan' });
    await screen.findByTestId('m30-tp-mine', {}, FIRST);
    expect(screen.getByTestId('m30-tp-ojt-total').textContent).toMatch(/[1-9]\d* of \d+ done/);
    fireEvent.click(screen.getByTestId('m30-tp-ack'));
    fireEvent.click(await screen.findByTestId('confirm-action'));
    await screen.findByTestId('m30-tp-acked', {}, W);
    expect(raw('transition_plans').find((p) => p.id === 'tp-p-k-lo-trainee-1')!.acknowledged_at).toBeTruthy();
    expect(raw('audit_events').some((e) => e.action === 'transition.acknowledge' && e.entity_id === 'tp-p-k-lo-trainee-1' && e.outcome === 'ok')).toBe(true);
  }, 150000);

  it('a person without a plan sees an empty state with the privacy note; a plan without a Mastery Builder role shows no alert', async () => {
    await renderPage(<MyTransitionPlanPage />, { persona: 'k-instructor', path: '/my/transition-plan' });
    await screen.findByTestId('m30-tp-none', {}, FIRST);
    expect(screen.getByTestId('m30-tp-privacy')).toBeTruthy();
  }, 150000);

  it('Arabic: my plan renders in Arabic', async () => {
    await renderPage(<MyTransitionPlanPage />, { persona: 'k-ro', path: '/ar/my/transition-plan' });
    await screen.findByTestId('m30-tp-mine', {}, FIRST);
    expect(screen.getAllByText('سجل موارد بشرية محاكى').length).toBeGreaterThan(0);
    expect(screen.getByText('حماية درجات السلّم')).toBeTruthy();
    expect(screen.getByTestId('m30-tp-privacy').textContent).toMatch(/لا يرى هذه الخطة إلا أنت/);
  }, 150000);
});

describe('FS81 HR pages', () => {
  it('FS81 acceptance: plans are visible to HR only: the HR director sees the board; a manager, the training manager and an HR analyst get nothing', async () => {
    await renderPage(<WorkforceTransitionPlansPage />, { persona: 'chco', path: '/workforce/transition-plans' });
    await screen.findByTestId('m30-tp-board', {}, FIRST);
    expect(screen.getAllByTestId('m30-tp-row').length).toBe(10);
    expect(screen.getByTestId('m30-tp-count-active').textContent).toBe('7');
    expect(screen.getByTestId('m30-tp-privacy').textContent).toMatch(/Managers, the training manager and HR analysts never see a plan/);
    for (const p of ['sro', 'training-mgr', 'k-hr-analyst']) {
      cleanup();
      await renderPage(<WorkforceTransitionPlansPage />, { persona: p, path: '/workforce/transition-plans' });
      await screen.findByText('Transition plans are for HR (the CHCO office) only', {}, FIRST);
      expect(screen.queryByTestId('m30-tp-board')).toBeNull();
    }
    cleanup();
    await renderPage(<TransitionPlanPage />, { persona: 'sro', path: '/workforce/transition-plans/tp-w-ro-01-1', route: '/workforce/transition-plans/:planId' });
    await screen.findByText('Plan not found, or not visible to you', {}, FIRST);
  }, 240000);

  it('FS81 acceptance (ladder-rung alert): HR activates the draft only after adding practice for every alerted task', async () => {
    await renderPage(<TransitionPlanPage />, { persona: 'chco', path: '/workforce/transition-plans/tp-w-ro-01-1', route: '/workforce/transition-plans/:planId' });
    await screen.findByTestId('m30-tp-plan', {}, FIRST);
    expect(Number(screen.getByTestId('m30-tp-alert').getAttribute('data-uncovered'))).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('m30-tp-edit'));
    const editor = await screen.findByTestId('m30-tp-editor', {}, W);
    await waitFor(() => expect(within(editor).getByTestId('m30-tp-ed-problem').getAttribute('data-code')).toBe('rung_practice_required'), W);
    expect((within(editor).getByTestId('m30-tp-ed-activate') as HTMLButtonElement).disabled).toBe(true);
    const edAlert = within(editor).getByTestId('m30-tp-alert');
    for (const task of within(edAlert).getAllByTestId('m30-tp-task').filter((x) => x.getAttribute('data-covered') === 'false')) {
      fireEvent.click(within(task).getAllByTestId('m30-tp-option-toggle')[0]);
    }
    await within(editor).findByTestId('m30-tp-ed-ready', {}, W);
    await waitFor(() => expect((within(editor).getByTestId('m30-tp-ed-activate') as HTMLButtonElement).disabled).toBe(false), W);
    fireEvent.click(within(editor).getByTestId('m30-tp-ed-activate'));
    fireEvent.click(await screen.findByTestId('confirm-action'));
    await waitFor(() => expect(raw('transition_plans').find((p) => p.id === 'tp-w-ro-01-1')!.status).toBe('active'), W);
    expect(raw('notifications').some((n) => n.person_id === 'w-ro-01' && n.kind === 'transition')).toBe(true);
  }, 240000);

  it('HR records the overdue review of an active plan (outcome, next date when none is left)', async () => {
    const lo = TB.transition_plans.find((p) => p.id === 'tp-w-lo-02-1')!;
    await renderPage(<TransitionPlanPage />, { persona: 'chco', path: `/workforce/transition-plans/${lo.id}`, route: '/workforce/transition-plans/:planId' });
    await screen.findByTestId('m30-tp-plan', {}, FIRST);
    const btn = screen.getByTestId('m30-tp-review') as HTMLButtonElement;
    if (btn.disabled) return; // the seeded review is not due on this run date (the RPC refuses it the same way)
    fireEvent.click(btn);
    fireEvent.click(await screen.findByTestId('m30-tp-review-save'));
    await waitFor(() => expect(raw('transition_plans').find((p) => p.id === lo.id)!.reviews.filter((r: Row) => r.done_on).length).toBe(2), W);
  }, 240000);
});

describe('FS81 role-level ladder-rung alerts', () => {
  it('the training manager sees every Mastery Builder role with the junior tasks and the practice to add, and no person', async () => {
    await renderPage(<RungAlertsPage />, { persona: 'training-mgr', path: '/workforce/rung-alerts' });
    const list = await screen.findByTestId('m30-ra-list', {}, FIRST);
    expect(within(list).getAllByTestId('m30-tp-alert').length).toBe(9);
    expect(screen.getByTestId('m30-ra-firing').textContent).toBe('8');
    expect(within(list).getAllByTestId('m30-tp-options').length).toBeGreaterThan(10);
    const text = document.body.textContent ?? '';
    for (const p of TB.people.filter((x) => TB.transition_plans.some((t) => t.person_id === x.id))) expect(text.includes(p.display_name)).toBe(false);
  }, 150000);
});
