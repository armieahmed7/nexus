// @vitest-environment jsdom
/** W2 · E2 page tests: F12 Career conversations (employee, line manager, HR insights, talent-review signal) with the real providers and the LocalBackend. */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderPage } from './g1-harness';
import { I18nProvider } from '../../src/i18n';
import MyConversationsPage from '../../src/modules/m18/MyConversationsPage';
import TeamConversationsPage from '../../src/modules/m18/TeamConversationsPage';
import ConversationInsightsPage from '../../src/modules/m18/ConversationInsightsPage';
import { AspirationSignalCard } from '../../src/modules/m18/AspirationSignal';
import { getLocalBackend } from '../../src/data';


// cold LocalBackend start-up (seed parse) can exceed the 5 s default on a loaded machine
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
const T = 15000;

describe('F12 employee page', () => {
  it('k-ro: pre-filled agenda with readiness reasons, a private draft, then sharing it with the line manager through a confirmation', async () => {
    await renderPage(<MyConversationsPage />, { persona: 'k-ro', path: '/my/career/conversations' });
    const agenda = await screen.findByTestId('m18-cc-agenda', {}, { timeout: T });
    expect(within(agenda).getAllByTestId('m18-cc-ag-target').length).toBeGreaterThan(0);
    fireEvent.click(within(agenda).getAllByTestId('m18-cc-ag-why')[0]);
    expect(within(agenda).getByTestId('m18-cc-ag-why-panel').textContent).toMatch(/ready on the required competencies/);
    expect(screen.getByTestId('stepper')).toBeTruthy();
    const form = screen.getByTestId('m18-cc-prep-form');
    // the seeded draft carries k-ro's earlier answers; pick a third aspiration and share
    const lead = within(form).getAllByTestId('m18-cc-asp').find((x) => x.getAttribute('data-asp') === 'specialise')!;
    fireEvent.click(lead);
    expect(lead.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('m18-cc-share'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toMatch(/line manager of record will see/);
    fireEvent.click(within(dialog).getByRole('button', { name: /Share with my line manager/ }));
    expect(await screen.findByText('Shared with your line manager', {}, { timeout: T })).toBeTruthy();
    const b = getLocalBackend();
    const row = b.raw('career_conversations').find((c) => c.person_id === 'p-k-ro' && c.status === 'draft')!;
    expect(row.manager_read_id).toBe('p-sro');
    expect((row.prep as { aspirations: string[] }).aspirations).toContain('specialise');
  });

  it('sq-lead: the held conversation shows the notes and agreed actions; disagreeing needs a comment; acknowledging locks it', async () => {
    await renderPage(<MyConversationsPage />, { persona: 'sq-lead', path: '/my/career/conversations' });
    const view = await screen.findByTestId('m18-cc-ack-view', {}, { timeout: T });
    expect(within(view).getAllByTestId('m18-cc-action').length).toBeGreaterThan(0);
    expect(within(view).getByTestId('m18-cc-plan-link').textContent).toMatch(/development plan as draft activities/);
    fireEvent.click(within(view).getByLabelText(/I disagree with part of it/));
    fireEvent.click(screen.getByTestId('m18-cc-ack'));
    expect(await screen.findByText('Say briefly what you disagree with.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.change(within(view).getByLabelText(/What do you disagree with/), { target: { value: 'I would like the rotation earlier.' } });
    fireEvent.click(screen.getByTestId('m18-cc-ack'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Acknowledge' }));
    expect(await screen.findByText('Conversation acknowledged with your comment', {}, { timeout: T })).toBeTruthy();
    const row = getLocalBackend().raw('career_conversations').find((c) => c.person_id === 'p-sq-lead' && c.employee_comment === 'I would like the rotation earlier.');
    expect(row?.status).toBe('acknowledged');
  });

  it('renders in Arabic (RTL) with translated statuses', async () => {
    await renderPage(<MyConversationsPage />, { persona: 'k-ro', path: '/ar/my/career/conversations' });
    await screen.findByTestId('m18-cc-agenda', {}, { timeout: T });
    expect(document.title).toContain('الحوارات المهنية');
    expect(screen.getByText('من يرى ماذا')).toBeTruthy();
  });
});

describe('F12 line manager page', () => {
  it('head-sq: qc-inspector shared a preparation; the workspace shows it, suggests actions with reasons, records the conversation; no acknowledge action for the manager', async () => {
    await renderPage(<TeamConversationsPage />, { persona: 'head-sq', path: '/team/conversations' });
    const list = await screen.findByTestId('m18-cc-team', {}, { timeout: T });
    const qc = within(list).getAllByTestId('m18-cc-person').find((x) => x.getAttribute('data-person') === 'p-qc-inspector')!;
    expect(within(qc).getByTestId('m18-cc-status').getAttribute('data-status')).toBe('shared');
    fireEvent.click(within(qc).getByTestId('m18-cc-open'));
    const ws = await screen.findByTestId('m18-cc-workspace', {}, { timeout: T });
    expect(within(ws).getByTestId('m18-cc-prep-summary').textContent).toMatch(/Move laterally/);
    const sugg = await within(ws).findByTestId('m18-cc-suggestions', {}, { timeout: T });
    fireEvent.click(within(sugg).getAllByTestId('m18-cc-sugg-why')[0]);
    expect(within(sugg).getByTestId('m18-cc-sugg-why-panel').textContent!.length).toBeGreaterThan(10);
    fireEvent.click(within(sugg).getAllByTestId('m18-cc-sugg-add')[0]);
    expect(within(ws).getByTestId('m18-cc-action-editor').children.length).toBe(1);
    expect(within(ws).queryByTestId('m18-cc-ack')).toBeNull();
    fireEvent.click(within(ws).getByTestId('m18-cc-record'));
    const dialogs = await screen.findAllByRole('dialog');
    const confirm = dialogs[dialogs.length - 1];
    expect(confirm.textContent).toMatch(/development plan as draft activities/);
    fireEvent.click(within(confirm).getByRole('button', { name: 'Record conversation' }));
    expect(await screen.findByText(/Conversation recorded/, {}, { timeout: T })).toBeTruthy();
    await waitFor(() => expect(getLocalBackend().raw('career_conversations').find((c) => c.person_id === 'p-qc-inspector' && c.status === 'held')).toBeTruthy());
    const held = getLocalBackend().raw('career_conversations').find((c) => c.person_id === 'p-qc-inspector' && c.status === 'held')!;
    expect(getLocalBackend().raw('plan_activities').filter((a) => a.id.startsWith(`pa-cc-${held.id}-`)).length).toBe(1);
  });

  it('a person with no reports of record sees an empty state', async () => {
    await renderPage(<TeamConversationsPage />, { persona: 'k-instructor', path: '/team/conversations' });
    expect(await screen.findByText('Nobody reports to you on record', {}, { timeout: T })).toBeTruthy();
  });
});

describe('F12 HR insights and the talent-review signal', () => {
  it('k-hr-analyst: aggregates with suppressed families and no names', async () => {
    await renderPage(<ConversationInsightsPage />, { persona: 'k-hr-analyst', path: '/workforce/career-conversations' });
    const heat = await screen.findByTestId('m18-cc-ins-heat', {}, { timeout: T });
    expect(heat).toBeTruthy();
    expect(screen.getAllByText('suppressed').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/role card|Al Suwaidi|Reactor Operator \(role card\)/);
  });

  it('with consent off, the talent-review card shows "Aspiration not shared"; with consent on, the aspiration', () => {
    const { rerender } = render(<MemoryRouter><I18nProvider><AspirationSignalCard signal={{ person_id: 'p-x', shared: false, reason: 'not_shared' }} /></I18nProvider></MemoryRouter>);
    expect(screen.getByTestId('m18-aspiration').textContent).toBe('Aspiration not shared');
    rerender(<MemoryRouter><I18nProvider><AspirationSignalCard signal={{ person_id: 'p-x', shared: true, reason: 'shared', aspirations: ['lead'], mobility: 'any', leadership: 'ready', goal_12m: 'Lead a crew', held_on: '2026-09-01' }} /></I18nProvider></MemoryRouter>);
    expect(screen.getByTestId('m18-aspiration').textContent).toMatch(/Lead people/);
    expect(screen.getByTestId('m18-aspiration').getAttribute('data-shared')).toBe('true');
  });
});
