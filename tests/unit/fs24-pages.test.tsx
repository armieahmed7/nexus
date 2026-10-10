// @vitest-environment jsdom
/**
 * [FS wave B · E4 · FS13 + FS14] Pages. /my/future shows readiness v2 (both ceilings, coverage, "what raises it" with +points, a
 * before/after preview, ADVANCE tracks whose completion moves the index on screen), the FS13 and FS14 benchmark chips, and
 * Horizon lanes 2.0 (eleven lanes, board and timeline, a lane drawer with sources, FS02 skills, open gigs; the fusion lane is
 * awareness only). /my/future/:tech shows the v2 breakdown; /workforce/future/interest shows the eleven lanes, suppressed under 10.
 * EN and AR.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import MyFuturePage from '../../src/modules/m21/MyFuturePage';
import MyFutureTechPage from '../../src/modules/m21/MyFutureTechPage';
import FutureDemandPage from '../../src/modules/m21/FutureDemandPage';
import en from '../../src/i18n/m21.en.json';
import ar from '../../src/i18n/m21.ar.json';
import m11en from '../../src/i18n/m11.en.json';
import m11ar from '../../src/i18n/m11.ar.json';

const chips = (box: HTMLElement) => Array.from(box.querySelectorAll('button[data-testid^="benchmark-chip-"]')).map((x) => x.getAttribute('data-testid')!.replace('benchmark-chip-', ''));
const num = (s: string | null | undefined) => Number((s ?? '').replace(/[^\d.]/g, ''));
const overall = () => num(screen.getByTestId('m21-index-overall').querySelector('.num')?.textContent);

describe('/my/future (FS13 readiness v2 + FS14 lanes)', () => {
  it('shows readiness v2 with both ceilings, coverage, ranked "what raises it", tracks, eleven lanes and the FS13 / FS14 benchmark chips', async () => {
    await renderPage(<MyFuturePage />, { persona: 'k-ro', path: '/my/future' });
    await waitFor(() => expect(screen.getAllByTestId('m21-raise').length).toBeGreaterThanOrEqual(3));
    expect(screen.getByTestId('m21-v2-meter')).toBeTruthy();
    expect(screen.getByTestId('m21-v2-cover').textContent).toContain(en.v2.cover.learn);
    expect(document.body.textContent).toContain(en.v2.rule);
    for (const el of screen.getAllByTestId(/^m21-index/)) { expect(el.textContent).toContain('SIMULATED'); expect(el.textContent).toContain(m11en.common.noDecision); }
    const deltas = screen.getAllByTestId('m21-raise-delta').map((x) => num(x.textContent));
    expect(deltas.every((x) => x > 0)).toBe(true);
    expect(screen.getAllByTestId('m21-track')).toHaveLength(4);
    expect(screen.getAllByTestId('m21-lane')).toHaveLength(11);
    await waitFor(() => expect(chips(screen.getByTestId('m21-bench-fs13'))).toEqual(['SMR-WF', 'NEA', 'IAEA-WFP']));
    await waitFor(() => expect(chips(screen.getByTestId('m21-bench-fs14'))).toEqual(['IAEA-AI', 'ENERGY-JOBS', 'SMR-WF', 'NEA']));
    expect(screen.getAllByTestId('why-this').length).toBeGreaterThan(20);
  });

  it('a preview shows before and after with exactly the +points on the card', async () => {
    await renderPage(<MyFuturePage />, { persona: 'k-ro', path: '/my/future' });
    await waitFor(() => expect(screen.getAllByTestId('m21-raise').length).toBeGreaterThanOrEqual(3));
    const card = screen.getAllByTestId('m21-raise')[0];
    const plus = num(within(card).getByTestId('m21-raise-delta').textContent);
    fireEvent.click(within(card).getByTestId('m21-preview-open'));
    const pv = await screen.findByTestId('m21-preview');
    expect(num(within(pv).getByTestId('m21-preview-delta').textContent)).toBe(plus);
    expect(within(pv).getByTestId('m21-index-before')).toBeTruthy();
    expect(num(within(pv).getByTestId('m21-index-after').querySelector('.num')?.textContent)).toBeGreaterThan(num(within(pv).getByTestId('m21-index-before').querySelector('.num')?.textContent));
  });

  it('finishing an ADVANCE track on screen raises the readiness index (learning moves it)', async () => {
    await renderPage(<MyFuturePage />, { persona: 'k-ro', path: '/my/future' });
    await waitFor(() => expect(screen.getAllByTestId('m21-track')).toHaveLength(4));
    const before = overall();
    const track = screen.getAllByTestId('m21-track').find((x) => x.textContent?.includes('Advanced reactor families'))!;
    const steps = within(track).getAllByTestId('m21-track-step');
    expect(steps.filter((s) => s.getAttribute('aria-pressed') === 'true')).toHaveLength(2); // seeded: 2 of 4 done
    fireEvent.click(steps[2]);
    await waitFor(() => expect(within(screen.getAllByTestId('m21-track').find((x) => x.textContent?.includes('Advanced reactor families'))!).getAllByTestId('m21-track-step')[2].getAttribute('aria-pressed')).toBe('true'));
    fireEvent.click(within(screen.getAllByTestId('m21-track').find((x) => x.textContent?.includes('Advanced reactor families'))!).getAllByTestId('m21-track-step')[3]);
    await waitFor(() => expect(overall()).toBeGreaterThan(before));
  });

  it('a lane opens a drawer with its FS02 skills, learning, open gigs, milestones and three or more sources; the timeline shows every lane', async () => {
    await renderPage(<MyFuturePage />, { persona: 'k-ro', path: '/my/future' });
    await waitFor(() => expect(screen.getAllByTestId('m21-lane')).toHaveLength(11));
    const lane = screen.getAllByTestId('m21-lane').find((x) => x.textContent?.includes('AI-augmented maintenance'))!;
    fireEvent.click(within(lane).getByTestId('m21-lane-open'));
    const drawer = await screen.findByTestId('m21-lane-drawer');
    expect(within(drawer).getByTestId('m21-lane-skills').querySelectorAll('li').length).toBeGreaterThanOrEqual(6);
    expect(within(drawer).getByTestId('m21-lane-gigs').querySelectorAll('li')).toHaveLength(2); // the closed gig is not shown
    expect(within(drawer).getByTestId('m21-sources').querySelectorAll('li').length).toBeGreaterThanOrEqual(3);
    expect(drawer.textContent).toContain('ENECIQ');
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(en.hz2.timeline) }));
    await waitFor(() => expect(screen.getAllByTestId('m21-swimlane')).toHaveLength(11));
    expect(screen.getByTestId('m21-milestones').querySelectorAll('li').length).toBeGreaterThanOrEqual(12);
  });

  it('a deep link opens the fusion lane: awareness only, no learning goal', async () => {
    await renderPage(<MyFuturePage />, { persona: 'k-ro', path: '/my/future?lane=lane-fusion' });
    const drawer = await screen.findByTestId('m21-lane-drawer', {}, { timeout: 30000 });
    const dialog = drawer.closest('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain(en.hz2.watchNoGoal);
    expect(within(dialog).queryByTestId('m21-goal')).toBeNull();
    expect(within(dialog).getByTestId('m21-interest')).toBeTruthy();
  });

  it('renders in Arabic', async () => {
    await renderPage(<MyFuturePage />, { persona: 'k-ro', path: '/ar/my/future' });
    await waitFor(() => expect(screen.getAllByTestId('m21-raise').length).toBeGreaterThanOrEqual(3));
    expect(document.body.textContent).toContain(ar.v2.raise.title);
    expect(document.body.textContent).toContain(ar.hz2.title);
    expect(document.body.textContent).toContain(ar.v2.tracks.title);
    for (const el of screen.getAllByTestId(/^m21-index/)) expect(el.textContent).toContain(m11ar.common.noDecision);
  });
});

describe('/my/future/:tech and /workforce/future/interest', () => {
  it('the family page shows the v2 breakdown (carry, new capability, learning, credit) and what raises this family', async () => {
    await renderPage(<MyFutureTechPage />, { persona: 'k-ro', path: '/my/future/bwr', route: '/my/future/:tech' });
    await waitFor(() => expect(screen.getAllByTestId('m21-credit')).toHaveLength(5));
    expect(document.body.textContent).toContain(en.v2.tech.carry);
    expect(screen.getByTestId('m21-tech-raises').querySelectorAll('li').length).toBeGreaterThan(0);
    await waitFor(() => expect(chips(screen.getByTestId('m21-bench-fs13'))).toEqual(['SMR-WF', 'NEA', 'IAEA-WFP']));
  });
  it('HR sees all eleven lanes by horizon, with cells under 10 suppressed, and the FS14 chips', async () => {
    await renderPage(<FutureDemandPage />, { persona: 'k-hr-analyst', path: '/workforce/future/interest' });
    await waitFor(() => expect(screen.getByTestId('m21-demand').textContent).toContain('HZ-11'));
    const table = screen.getByTestId('m21-demand');
    for (const c of ['HZ-6', 'HZ-7', 'HZ-8', 'HZ-9', 'HZ-10', 'HZ-11']) expect(table.textContent).toContain(c);
    const grid = Array.from(table.querySelectorAll('tr')).find((r) => r.textContent?.includes('HZ-10'))!;
    expect(grid.textContent).toMatch(/suppressed|<\s?10/i);
    await waitFor(() => expect(chips(screen.getByTestId('m21-bench-fs14'))).toEqual(['IAEA-AI', 'ENERGY-JOBS', 'SMR-WF', 'NEA']));
  });
});
