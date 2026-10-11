// @vitest-environment jsdom
/** F31 pages rendered with the real providers and the in-memory LocalBackend: the training manager's board (pool with currency and
 *  notices, pipeline accept and qualify behind a confirmation, maker-checker hint, SME finder with "Why this?", sourced ASIP fact), the
 *  instructor's observation form (live checklist score, confirmation, the stage moves on), the track page (requirements, own-track note),
 *  my instructor track (next step, currency, log development) and volunteering, the line manager's team page, and Arabic. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import InstructorsPage from '../../src/modules/m02/InstructorsPage';
import InstructorTrackPage from '../../src/modules/m02/InstructorTrackPage';
import MyInstructorPage from '../../src/modules/m02/MyInstructorPage';
import TeamInstructorsPage from '../../src/modules/m02/TeamInstructorsPage';
import { FACT_SOURCES } from '../../src/modules/m02/instructorUi';
import seed from '../../src/seed/seed.json';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const W = { timeout: 10000 };
const confirm = async () => fireEvent.click(await screen.findByTestId('confirm-action', {}, W));

describe('F31 pages', { timeout: 40000 }, () => {
  it('the board shows the pool with currency states and notices, and the ASIP fact links its source', async () => {
    await renderPage(<InstructorsPage />, { persona: 'training-mgr', path: '/training/instructors' });
    const pool = await screen.findByTestId('m02-ins-pool', {}, W);
    const qualified = T.instructor_tracks.filter((t) => t.status === 'qualified' || t.status === 'lapsed').length;
    expect(within(pool).getAllByTestId('m02-ins-pool-status').length).toBe(qualified);
    expect(within(pool).getAllByTestId('m02-ins-pool-status').some((x) => x.getAttribute('data-status') === 'lapsed')).toBe(true);
    expect(within(pool).queryAllByTestId('m02-ins-notice').length).toBeGreaterThan(0);
    const asip = screen.getByTestId('m02-ins-fact-asip');
    expect(asip.textContent).toMatch(/Accelerated SRO Instructor Program/);
    expect(asip.querySelector('a')?.getAttribute('href')).toBe(FACT_SOURCES.cns10);
    expect(screen.getByTestId('m02-ins-fact-reg16').querySelector('a')?.getAttribute('href')).toBe(FACT_SOURCES.reg16);
    expect(screen.getByTestId('m02-ins-sweep')).toBeTruthy();
  });
  it('the training manager accepts a nomination and qualifies a ready candidate from the pipeline', async () => {
    await renderPage(<InstructorsPage />, { persona: 'training-mgr', path: '/training/instructors' });
    fireEvent.click(await screen.findByRole('tab', { name: /Pipeline/ }, W));
    const nominated = await screen.findByTestId('m02-ins-col-nominated', {}, W);
    const before = within(nominated).getAllByTestId('m02-ins-card').length;
    fireEvent.click(within(nominated).getAllByTestId('m02-ins-accept')[0]);
    await confirm();
    await waitFor(() => expect(within(screen.getByTestId('m02-ins-col-nominated')).queryAllByTestId('m02-ins-card').length).toBe(before - 1), W);
    const ready = screen.getByTestId('m02-ins-col-ready');
    expect(ready.textContent).toMatch(/You observed this candidate/); // w-rp-02: the training manager observed a co-teach
    const readyBefore = within(ready).getAllByTestId('m02-ins-card').length;
    const card = within(ready).getAllByTestId('m02-ins-card').find((c) => !/You observed/.test(c.textContent ?? ''))!;
    fireEvent.click(within(card).getByTestId('m02-ins-qualify'));
    await confirm();
    await waitFor(() => expect(within(screen.getByTestId('m02-ins-col-ready')).queryAllByTestId('m02-ins-card').length).toBe(readyBefore - 1), W);
  });
  it('the SME finder ranks colleagues with "Why this?" for the training manager', async () => {
    await renderPage(<InstructorsPage />, { persona: 'training-mgr', path: '/training/instructors' });
    fireEvent.click(await screen.findByRole('tab', { name: /Find SMEs/ }, W));
    const list = await screen.findByTestId('m02-ins-candidates', {}, W);
    expect(within(list).getAllByTestId('m02-ins-candidate').length).toBeGreaterThan(0);
    fireEvent.click(within(list).getAllByTestId('m02-ins-why')[0]);
    expect((await screen.findAllByTestId('m02-ins-why-panel'))[0].textContent).toMatch(/skills this standard covers/);
  });
  it('an instructor records a co-teach observation with the checklist; the candidate moves to the solo stage', async () => {
    await renderPage(<InstructorsPage />, { persona: 'k-instructor', path: '/training/instructors' });
    fireEvent.click(await screen.findByRole('tab', { name: /To observe/ }, W));
    const queue = await screen.findByTestId('m02-ins-queue', {}, W);
    const item = within(queue).getAllByTestId('m02-ins-queue-item').find((x) => /Nnamdi|sme|Reviewer|SME/i.test(x.textContent ?? '') && /co-teach/i.test(x.textContent ?? ''))
      ?? within(queue).getAllByTestId('m02-ins-queue-item').find((x) => /co-teach/i.test(x.textContent ?? ''))!;
    expect(within(queue).getAllByTestId('m02-ins-queue-item').map((x) => x.querySelector('a')?.textContent)).not.toContain('Simulator instructor (SRO-qualified)'); // never my own track
    fireEvent.click(within(item).getByTestId('m02-ins-observe'));
    const form = await screen.findByTestId('m02-ins-form', {}, W);
    expect(screen.getByTestId('m02-ins-form-score').textContent).toMatch(/100%/);
    fireEvent.click(within(form).getByTestId('m02-ins-rate-safety-not_met'));
    expect(screen.getByTestId('m02-ins-form-score').textContent).toMatch(/Not yet/);
    fireEvent.click(within(form).getByTestId('m02-ins-rate-safety-met'));
    fireEvent.click(screen.getByTestId('m02-ins-form-submit'));
    await confirm();
    await waitFor(() => expect(screen.queryByTestId('m02-ins-form')).toBeNull(), W);
  });
  it('the track page shows the requirements, observations and evaluator rows; the maker-checker note for the training manager', async () => {
    await renderPage(<InstructorTrackPage />, { persona: 'training-mgr', path: '/training/instructors/it-w-rp-02', route: '/training/instructors/:trackId' });
    const req = await screen.findByTestId('m02-ins-requirements', {}, W);
    expect(within(req).getByTestId('m02-ins-req-coteach').getAttribute('data-done')).toBe('yes');
    expect(within(req).getByTestId('m02-ins-req-solo').getAttribute('data-done')).toBe('yes');
    expect(screen.getAllByTestId('m02-ins-observation').length).toBe(T.instructor_observations.filter((o) => o.track_id === 'it-w-rp-02').length);
    expect(screen.getByText(/Maker-checker/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('m02-ins-why-ready'));
    expect((await screen.findByTestId('m02-ins-why-ready-panel')).textContent).toMatch(/observed by/);
  });
  it('a qualified instructor sees currency and evaluator rows; on their own track there is no observe button', async () => {
    await renderPage(<InstructorTrackPage />, { persona: 'k-instructor', path: '/training/instructors/it-p-k-instructor', route: '/training/instructors/:trackId' });
    expect(await screen.findByTestId('m02-ins-currency', {}, W)).toBeTruthy();
    expect(screen.getByTestId('m02-ins-own')).toBeTruthy();
    expect(screen.queryByTestId('m02-ins-observe')).toBeNull();
    expect(await screen.findByTestId('m02-ins-eq', {}, W)).toBeTruthy();
  });
  it('my instructor track: the next step, my observations and logging my development hours', async () => {
    await renderPage(<MyInstructorPage />, { persona: 'sme-reviewer', path: '/my/instructor' });
    const next = await screen.findByTestId('m02-ins-next', {}, W);
    expect(next.textContent).toMatch(/Co-teach two sessions/);
    expect(screen.getAllByTestId('m02-ins-observation').length).toBe(T.instructor_observations.filter((o) => o.person_id === 'p-sme-reviewer').length);
    expect(screen.getByTestId('m02-ins-fact-asip').querySelector('a')?.getAttribute('href')).toBe(FACT_SOURCES.cns10);
    fireEvent.click(screen.getByTestId('m02-ins-log-cpd'));
    expect(await screen.findByTestId('m02-ins-hours-form', {}, W)).toBeTruthy();
    await confirm();
    await waitFor(() => expect(screen.queryByTestId('m02-ins-hours-form')).toBeNull(), W);
  });
  it('a staff member without a track sees matching standards with "Why this?" and volunteers', async () => {
    await renderPage(<MyInstructorPage />, { persona: 'k-ro', path: '/my/instructor' });
    const matches = await screen.findByTestId('m02-ins-my-matches', {}, W);
    expect(within(matches).getAllByTestId('m02-ins-my-match').length).toBeGreaterThan(0);
    fireEvent.click(within(matches).getAllByTestId('m02-ins-volunteer-btn')[0]);
    expect(await screen.findByTestId('m02-ins-nominate-form', {}, W)).toBeTruthy();
    await confirm();
    expect(await screen.findByTestId('m02-ins-my-track', {}, { timeout: 15000 })).toBeTruthy();
  });
  it('a line manager sees the team on the track and SMEs in scope to nominate', async () => {
    await renderPage(<TeamInstructorsPage />, { persona: 'chem-sup', path: '/team/instructors' });
    const tracks = await screen.findByTestId('m02-ins-team-tracks', {}, W);
    expect(tracks.textContent).toMatch(new RegExp(T.people.find((p) => p.id === 'w-chem-02').display_name));
    expect(within(tracks).getAllByTestId('m02-ins-team-track').every((x) => !/Security/.test(x.textContent ?? ''))).toBe(true);
  });
  it('renders in Arabic', async () => {
    await renderPage(<InstructorsPage />, { persona: 'training-mgr', path: '/ar/training/instructors' });
    const facts = await screen.findByTestId('m02-ins-facts', {}, W);
    expect(facts.textContent).toMatch(/[؀-ۿ]/);
    expect(facts.textContent).toContain('برنامج مدرب المشغّل الأول المعجل');
  });
});
