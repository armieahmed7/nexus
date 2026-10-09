// @vitest-environment jsdom
/** F25/F26 pages rendered with the real providers and the in-memory LocalBackend: the scorecard (suppressed cells, SAMPLE label,
 *  "Why this?" evidence, committee pack with <10), the course page (L4 caveat + SAMPLE, suppressed levels), L3 observations
 *  (line manager records a checklist), the learner's anonymous L1 form, the needs forecast (drill-down sums, suppression for HR,
 *  SIMULATED intake, draft proposals) and the drafts card on /training/schedule. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import EffectivenessPage from '../../src/modules/m25/EffectivenessPage';
import EffectivenessCoursePage from '../../src/modules/m25/EffectivenessCoursePage';
import ObservationsPage from '../../src/modules/m25/ObservationsPage';
import MyFeedbackPage from '../../src/modules/m25/MyFeedbackPage';
import NeedsPage from '../../src/modules/m25/NeedsPage';
import TrainingSchedulePage from '../../src/modules/m04/TrainingSchedulePage';
import { getLocalBackend } from '../../src/data';

const T = { timeout: 20000 };

describe('F25 pages', { timeout: 90000 }, () => {
  it('scorecard: instructors see aggregates only, suppressed cells, SAMPLE label and the evidence; no scheduling control', async () => {
    await renderPage(<EffectivenessPage />, { persona: 'k-instructor', path: '/training/effectiveness' });
    const row = await screen.findByTestId('m25-course-c-get', {}, T);
    expect(row.textContent).toMatch(/General Employee Training/);
    expect(screen.getByTestId('m25-eff-labels').textContent).toMatch(/SAMPLE/i);
    expect(screen.queryByTestId('m25-schedule-l3')).toBeNull();
    await waitFor(() => expect(screen.getAllByTestId('m25-suppressed').length).toBeGreaterThan(3), T);
    fireEvent.click(screen.getByTestId('why-c-sec-aw'));
    expect((await screen.findByTestId('why-c-sec-aw-panel')).textContent).toMatch(/Relevance averages/);
    expect(screen.getByTestId('m25-flags').textContent).toMatch(/Security/);
  });
  it('committee pack: per committee, cells under 10 print as <10, CSV and print available; the training manager can schedule L3', async () => {
    await renderPage(<EffectivenessPage />, { persona: 'training-mgr', path: '/training/effectiveness' });
    await screen.findByTestId('m25-course-c-get', {}, T);
    expect(screen.getByTestId('m25-schedule-l3')).toBeTruthy();
    fireEvent.click(screen.getByTestId('m25-pack-open'));
    const pack = await screen.findByTestId('m25-pack');
    fireEvent.change(within(pack).getByTestId('m25-pack-committee'), { target: { value: 'operations' } });
    await waitFor(() => expect(pack.textContent).toMatch(/<10/), T);
    expect(screen.getByTestId('m25-pack-csv')).toBeTruthy();
    expect(screen.getByTestId('m25-pack-print')).toBeTruthy();
  });
  it('course page: four levels with the L4 caveat and SAMPLE chip; a small course shows "not enough data"', async () => {
    await renderPage(<EffectivenessCoursePage />, { persona: 'training-mgr', path: '/training/effectiveness/c-hu', route: '/training/effectiveness/:courseId' });
    expect(await screen.findByTestId('m25-l1', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m25-l2')).toBeTruthy();
    expect(screen.getByTestId('m25-l3').textContent).toMatch(/observed in daily work/);
    expect(screen.getByTestId('m25-l4').textContent).toMatch(/HU-related event rate/);
    expect(document.body.textContent).toMatch(/Association, not causation/);
    expect(screen.getByTestId('m25-flag-open')).toBeTruthy();
  });
  it('course page with fewer than 10 answers suppresses L1', async () => {
    await renderPage(<EffectivenessCoursePage />, { persona: 'k-instructor', path: '/training/effectiveness/c-coct', route: '/training/effectiveness/:courseId' });
    await screen.findByTestId('m25-course-head', {}, T);
    expect(screen.queryByTestId('m25-l1')).toBeNull();
    expect(document.body.textContent).toMatch(/Results show when 10 or more people have answered/);
    expect(document.body.textContent).toMatch(/Association, not causation/);
    expect(screen.queryByTestId('m25-flag-open')).toBeNull();
  });
  it('L3: the line manager records a complete checklist for their team', async () => {
    await renderPage(<ObservationsPage />, { persona: 'sro', path: '/training/observations' });
    const board = await screen.findByTestId('m25-l3-board', {}, T);
    expect(board.textContent).toMatch(/Observations for your team/);
    const btn = within(board).getAllByRole('button').find((x) => x.getAttribute('data-testid')?.startsWith('m25-l3-record-'))!;
    fireEvent.click(btn);
    const form = await screen.findByTestId('m25-l3-form');
    for (const fs of Array.from(form.querySelectorAll('fieldset fieldset'))) fireEvent.click(within(fs as HTMLElement).getByLabelText('Partly'));
    fireEvent.click(screen.getByTestId('m25-l3-save'));
    await waitFor(() => expect(screen.queryByTestId('m25-l3-form')).toBeNull(), T);
    expect(getLocalBackend().raw('l3_observations').filter((o) => o.recorded_by === 'p-sro' && o.items.every((i: { rating: string }) => i.rating === 'partly')).length).toBe(1);
  });
  it('L1: the learner sees the anonymity promise and sends a pending form', async () => {
    await renderPage(<MyFeedbackPage />, { persona: 'sro', path: '/my/learning/feedback' });
    const pending = await screen.findByTestId('m25-my-pending', {}, T);
    expect(document.body.textContent).toMatch(/Anonymous to instructors and managers/);
    const form = within(pending).getByTestId('m25-l1-form-c-get');
    for (const g of within(form).getAllByRole('radiogroup')) { const r = within(g).getAllByRole('radio'); fireEvent.click(r[Math.min(3, r.length - 1)]); }
    const submit = within(pending).getAllByRole('button').find((x) => x.getAttribute('data-testid')?.startsWith('m25-l1-submit-'))!;
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() => expect(getLocalBackend().raw('eval_responses').some((r) => r.person_id === 'p-sro' && r.course_id === 'c-get' && r.completion_ref.startsWith('en:'))).toBe(true), T);
  });
});

describe('F26 pages', { timeout: 90000 }, () => {
  it('needs forecast (training manager): exact cells, drill-down that sums to the cell, SIMULATED intake, propose a draft', async () => {
    await renderPage(<NeedsPage />, { persona: 'training-mgr', path: '/training/needs' });
    const row = await screen.findByTestId('m25-needs-row-c-get', {}, T);
    expect(row).toBeTruthy();
    fireEvent.click(screen.getByTestId('m25-drill-c-get-expiry'));
    const drill = await screen.findByTestId('m25-drill');
    expect(within(drill).getByTestId('m25-drill-sum').textContent).toMatch(/adds up/);
    fireEvent.change(screen.getByTestId('m25-needs-dnt'), { target: { value: '20' } });
    expect(await screen.findByText(/SIMULATED intake/i)).toBeTruthy();
    fireEvent.change(screen.getByTestId('m25-needs-dnt'), { target: { value: '0' } });
    expect(screen.getByTestId('m25-drafts').textContent).toMatch(/Draft, not published/);
  });
  it('needs forecast (HR, aggregate): cells under 10 suppressed, totals shown, no compute or propose', async () => {
    await renderPage(<NeedsPage />, { persona: 'chco', path: '/training/needs' });
    await screen.findByTestId('m25-needs-row-c-get', {}, T);
    expect(document.body.textContent).toMatch(/Aggregate view/);
    expect(screen.getAllByTestId('m25-suppressed').length).toBeGreaterThan(3);
    expect(screen.queryByTestId('m25-needs-compute')).toBeNull();
    expect(screen.queryByTestId('m25-propose-c-get')).toBeNull();
  });
  it('/training/schedule shows the proposed sessions as drafts, not published', async () => {
    await renderPage(<TrainingSchedulePage />, { persona: 'training-mgr', path: '/training/schedule' });
    const card = await screen.findByTestId('m25-schedule-drafts', {}, T);
    expect(card.textContent).toMatch(/Draft, not published/);
    expect(document.body.textContent).toMatch(/Drafts, not published/);
  });
});
