// @vitest-environment jsdom
/** W1 · E2 page tests: Career Navigator, Career Roadmap and the team view render with the real providers and the LocalBackend. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import MyCareerPage from '../../src/modules/m18/MyCareerPage';
import MyRoadmapPage from '../../src/modules/m18/MyRoadmapPage';
import TeamCareerPage from '../../src/modules/m18/TeamCareerPage';

describe('F05 Career Navigator page', () => {
  it('k-ro: opportunity map, SRO move with readiness reasons, gates with the three SRO routes, roles like mine with a similar-skills reason', async () => {
    await renderPage(<MyCareerPage />, { persona: 'k-ro', path: '/my/career' });
    const moves = await screen.findByTestId('m18-moves', {}, { timeout: 8000 });
    expect(screen.getAllByTestId('m18-map-node').length).toBeGreaterThan(2);
    const sro = within(moves).getAllByTestId('m18-move').find((x) => x.getAttribute('data-role') === 'senior-reactor-operator')!;
    expect(sro).toBeTruthy();
    expect(sro.textContent).toMatch(/%/);
    fireEvent.click(within(sro).getByTestId('m18-why'));
    expect(within(sro).getByTestId('m18-why-panel').textContent).toMatch(/ready on the required competencies/);
    fireEvent.click(within(sro).getByTestId('m18-details'));
    const detail = await screen.findByTestId('m18-detail');
    const routes = within(detail).getAllByTestId('m18-gate-route').map((x) => x.getAttribute('data-route'));
    expect(routes).toEqual(expect.arrayContaining(['sro_ro24', 'sro_bsc', 'sro_other_plant']));
    expect(detail.textContent).toMatch(/FANR-REG-17 Art\. 4/);
    const similar = screen.getByTestId('m18-similar');
    fireEvent.click(within(similar).getAllByTestId('m18-similar-why')[0]);
    expect(within(similar).getByTestId('m18-similar-why-panel').textContent).toMatch(/skills match/);
    expect(screen.getByTestId('m18-shortlist').textContent).toMatch(/Senior Reactor Operator/);
  });

  it('security roles show the career path only (no %) on the map', async () => {
    await renderPage(<MyCareerPage />, { persona: 'k-ro', path: '/my/career' });
    await screen.findByTestId('m18-moves', {}, { timeout: 8000 });
    for (const n of screen.getAllByTestId('m18-map-node').filter((x) => x.getAttribute('data-band') === 'path_only')) expect(n.textContent).not.toMatch(/%/);
  });

  it('renders in Arabic RTL with flipped arrows on multi-step moves (k-lo-trainee)', async () => {
    await renderPage(<MyCareerPage />, { persona: 'k-lo-trainee', path: '/ar/my/career' });
    const moves = await screen.findByTestId('m18-moves', {}, { timeout: 8000 });
    expect(document.title).toContain('مستكشف المسار المهني');
    const twoStep = within(moves).getAllByTestId('m18-move').find((x) => x.getAttribute('data-role') === 'senior-reactor-operator')!;
    expect(twoStep.textContent).toContain('←');
    expect(twoStep.textContent).not.toContain('→');
  });

  it('a person without a job role sees an empty state, not a crash', async () => {
    await renderPage(<MyCareerPage />, { persona: 'k-hr-analyst', path: '/my/career' });
    expect(await screen.findByText(/No current role on file/, {}, { timeout: 8000 })).toBeTruthy();
  });
});

describe('F06 Career Roadmap page', () => {
  it('k-lo-trainee → RO: COIT with 91 weeks and its source, the FANR notice milestone, SAMPLE tags, and the slider moves the end date', async () => {
    await renderPage(<MyRoadmapPage />, { persona: 'k-lo-trainee', path: '/my/career/roadmap?role=reactor-operator' });
    const gantt = await screen.findByTestId('m18-gantt', {}, { timeout: 8000 });
    const prog = within(gantt).getAllByTestId('m18-gantt-block').find((x) => x.getAttribute('data-kind') === 'programme')!;
    expect(prog.textContent).toMatch(/COIT/);
    expect(within(gantt).getAllByTestId('m18-gantt-milestone').map((x) => x.getAttribute('data-kind'))).toEqual(expect.arrayContaining(['fanr_notice', 'fanr_exam', 'certification']));
    const sources = screen.getByTestId('m18-rm-sources');
    expect(sources.textContent).toMatch(/91 weeks/);
    expect(sources.textContent).toMatch(/Sustainability Report 2024/);
    expect(sources.textContent).toMatch(/SAMPLE/);
    const before = screen.getByTestId('m18-rm-end').textContent;
    fireEvent.change(screen.getByTestId('m18-scenario-a-delay'), { target: { value: '4' } });
    await waitFor(() => expect(screen.getByTestId('m18-rm-end').textContent).not.toBe(before));
    expect(screen.getByText(/months after the earliest possible/)).toBeTruthy();
  });

  it('compare mode shows two scenarios side by side', async () => {
    await renderPage(<MyRoadmapPage />, { persona: 'k-ro', path: '/my/career/roadmap?role=senior-reactor-operator' });
    await screen.findByTestId('m18-gantt', {}, { timeout: 8000 });
    fireEvent.click(screen.getByLabelText('Compare with a second scenario'));
    await waitFor(() => expect(screen.getAllByTestId('m18-gantt-scenario').length).toBe(2));
    expect(screen.getByTestId('m18-scenario-b')).toBeTruthy();
    expect(screen.getByText(/months later/)).toBeTruthy();
  });

  it('send to plan goes through a confirm dialog and reports the result', async () => {
    await renderPage(<MyRoadmapPage />, { persona: 'k-ro', path: '/my/career/roadmap?rm=rm-k-ro-sro' });
    await screen.findByTestId('m18-gantt', {}, { timeout: 8000 });
    fireEvent.click(screen.getByTestId('m18-rm-send'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toMatch(/audit log/);
    fireEvent.click(within(dialog).getAllByRole('button').find((b) => /Send to my development plan/.test(b.textContent ?? ''))!);
    expect(await screen.findByText(/Added to your development plan/, {}, { timeout: 8000 })).toBeTruthy();
  });
});

describe('Team career view', () => {
  it('the crew B supervisor sees k-ro\'s shared shortlist with readiness, and nothing unshared', async () => {
    await renderPage(<TeamCareerPage />, { persona: 'sro', path: '/team/career' });
    const team = await screen.findByTestId('m18-team', {}, { timeout: 8000 });
    const kro = within(team).getAllByTestId('m18-team-person').find((x) => x.getAttribute('data-person') === 'p-k-ro')!;
    expect(kro).toBeTruthy();
    await waitFor(() => expect(kro.textContent).toMatch(/Senior Reactor Operator/));
    expect(kro.textContent).not.toMatch(/Human Performance Specialist/);
  });
});
