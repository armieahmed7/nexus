// @vitest-environment jsdom
/** F10/F11 pages rendered with the real providers and the in-memory LocalBackend. */
import { describe, expect, it } from 'vitest';
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import { renderPage } from './g1-harness';
import CheckinsPage from '../../src/modules/m17/CheckinsPage';
import ValidatePage from '../../src/modules/m17/ValidatePage';
import TeamSkillsPage from '../../src/modules/m17/TeamSkillsPage';
import { routes } from '../../src/modules/m17/routes';

const WAIT = { timeout: 10000 };

describe('F10 /my/skills/checkins', () => {
  it('routes: the three wave-2 routes are registered with the right guards', () => {
    const r = Object.fromEntries(routes.map((x) => [x.id, x]));
    expect(r['my-skills-checkins'].path).toBe('/my/skills/checkins');
    expect(r['team-skills'].guard).toMatchObject({ grant: { res: 'skills_profile', levels: ['Scope', 'A', 'Agg'] } });
    expect(r['team-skills-validate'].guard).toMatchObject({ grant: { res: 'skills_profile', levels: ['Scope', 'A'] } });
  });
  it('k-ro sees the open check-in with peer answers; the new form never offers security or qualification-only skills', async () => {
    await renderPage(<CheckinsPage />, { persona: 'k-ro', path: '/my/skills/checkins' });
    const mine = await screen.findByTestId('m17-ci-mine', {}, WAIT);
    expect(mine.textContent).toMatch(/Answered|“/);
    fireEvent.click(screen.getByRole('tab', { name: /New check-in/ }));
    const list = await screen.findByTestId('m17-ci-skills', {}, WAIT);
    expect(within(list).queryByTestId('m17-ci-skill-sk-sa-01')).toBeNull();
    expect(within(list).queryByTestId('m17-ci-skill-sk-co-01-eop')).toBeNull();
    expect(within(list).queryByTestId('m17-ci-skill-sk-da-01')).toBeNull(); // already in an open check-in
    expect(within(list).getByTestId('m17-ci-skill-sk-hu-02')).toBeTruthy();
    expect(screen.getByTestId('m17-ci-qualonly').textContent).toMatch(/Verified by qualification only/);
    expect(within(screen.getByTestId('m17-ci-peers')).queryByText(/Shift/)).toBeNull();
  }, 90000); // FS wave C QA: the first test boots the 19 MB seed (about 27 s)
  it('a peer (buyer) answers only the skills named for them, never the self level', async () => {
    await renderPage(<CheckinsPage />, { persona: 'buyer', path: '/my/skills/checkins' });
    const asked = await screen.findByTestId('m17-ci-asked', {}, WAIT);
    const items = within(asked).getAllByTestId('m17-ci-peer-item');
    expect(items).toHaveLength(2);
    expect(asked.textContent).not.toMatch(/Self|My level/);
    fireEvent.click(within(items[0]).getByTestId(/^m17-level-peer-.*-3$/));
    fireEvent.change(within(items[0]).getByRole('textbox'), { target: { value: 'Saw this on a weekend inspection' } });
    fireEvent.click(within(items[1]).getByTestId(/^m17-level-peer-.*-0$/));
    fireEvent.click(screen.getByTestId('m17-ci-rate'));
    const dlg = await screen.findByRole('dialog', {}, WAIT);
    fireEvent.click(within(dlg).getByRole('button', { name: 'Send ratings' }));
    await waitFor(() => expect(screen.getAllByText(/your ratings were sent/i).length).toBeGreaterThan(0), WAIT);
  }, 90000); // FS wave C QA: the first test boots the 19 MB seed (about 27 s)
});

describe('F10 /team/skills/validate', () => {
  it('sro validates k-ro\'s check-in; calibration for crew B is suppressed', async () => {
    await renderPage(<ValidatePage />, { persona: 'sro', path: '/team/skills/validate' });
    const q = await screen.findByTestId('m17-val-queue', {}, WAIT);
    expect(q.textContent).toMatch(/Reactor Operator|k-ro|RO/);
    expect(within(q).getAllByTestId('m17-val-item').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole('tab', { name: /Calibration/ }));
    const cal = await screen.findByTestId('m17-cal', {}, WAIT);
    expect(cal.textContent).toMatch(/Distributions suppressed/);
  }, 90000); // FS wave C QA: the first test boots the 19 MB seed (about 27 s)
});

describe('F11 /team/skills', () => {
  it('sro sees crew B only, a single-point-of-failure flag and a SIMULATED what-if; the crew view has counts only', async () => {
    await renderPage(<TeamSkillsPage />, { persona: 'sro', path: '/team/skills' });
    const hm = await screen.findByTestId('m17-tm-heatmap', {}, WAIT);
    expect(within(hm).getAllByRole('row').length - 1).toBe(8);
    fireEvent.click(screen.getByLabelText(/What if someone leaves/));
    expect(screen.getAllByText('SIMULATED').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: /Coverage and targets/ }));
    expect((await screen.findAllByTestId('m17-spof', {}, WAIT)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: /Crew view/ }));
    const crews = await screen.findByTestId('m17-tm-crews', {}, WAIT);
    expect(crews.textContent).not.toMatch(/medical|licence|fit/i);
    fireEvent.click(screen.getByRole('tab', { name: /Suggested actions/ }));
    const acts = await screen.findByTestId('m17-tm-actions', {}, WAIT);
    expect(within(acts).getAllByTestId('why-this').length).toBeGreaterThan(0);
  }, 90000); // FS wave C QA: the first test boots the 19 MB seed (about 27 s)
  it('HR sees the aggregate view only', async () => {
    await renderPage(<TeamSkillsPage />, { persona: 'k-hr-analyst', path: '/team/skills' });
    await screen.findByText(/Aggregate view/, {}, WAIT);
    expect(screen.queryByTestId('m17-tm-heatmap')).toBeNull();
    expect(screen.queryByTestId('m17-tm-csv')).toBeNull();
  }, 90000); // FS wave C QA: the first test boots the 19 MB seed (about 27 s)
  it('Arabic: the heatmap page renders in Arabic', async () => {
    await renderPage(<TeamSkillsPage />, { persona: 'sro', path: '/ar/team/skills' });
    await screen.findByTestId('m17-tm-heatmap', {}, WAIT);
    expect(document.body.textContent).toMatch(/خريطة قدرات الفريق|الخريطة الحرارية/);
    expect(document.body.textContent).toMatch(/مناوبة التشغيل B/);
  }, 90000); // FS wave C QA: the first test boots the 19 MB seed (about 27 s)
});
