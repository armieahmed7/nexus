// @vitest-environment jsdom
/** FS15 / FS16 pages (FS wave B · E5): concept roles in the Career Navigator (k-ro), a roadmap to a concept role, a manager's view
 * of a shared concept target, and /careers/outlook-criteria for the public (label only, every threshold), staff (components) and
 * the HR director (preview), in English and Arabic. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import MyCareerPage from '../../src/modules/m18/MyCareerPage';
import MyRoadmapPage from '../../src/modules/m18/MyRoadmapPage';
import CareersOutlookCriteriaPage from '../../src/modules/m18/CareersOutlookCriteriaPage';
import en from '../../src/i18n/m18.en.json';
import ar from '../../src/i18n/m18.ar.json';
import { publicTextIsClean } from '../../src/domain/future';

const T = { timeout: 15000 };

describe('/my/career: future roles (FS15)', () => {
  it('lists the 11 concept roles next to current moves, with readiness, the banner, the bridge from k-ro\'s role and FS15 benchmarks', async () => {
    await renderPage(<MyCareerPage />, { path: '/my/career', persona: 'k-ro' });
    const list = await screen.findByTestId('m18-fs15-list', {}, T);
    const cards = within(list).getAllByTestId('m18-fs15-card');
    expect(cards).toHaveLength(11);
    // ranked: a concept role bridged from my own role (Reactor Operator) comes first
    expect(within(cards[0]).getByTestId('m18-fs15-bridge').getAttribute('data-mine')).toBe('true');
    const bwr = cards.find((c) => c.getAttribute('data-role') === 'fr-bwr-operator')!;
    expect(within(bwr).getByTestId('m18-fs15-concept-chip').textContent).toBe(en.fs15.conceptChip);
    expect(within(bwr).getByTestId('m18-fs15-band')).toBeTruthy();
    expect(within(bwr).getByTestId('m18-fs15-gaps').querySelectorAll('li').length).toBeGreaterThan(0);
    // closest real evidence (operations family moves), never a count for the concept role itself
    expect(within(bwr).getByTestId('m18-fs15-transition').textContent).toMatch(/colleagues moved from your role/);
    expect(screen.getByTestId('m18-fs15-banner').textContent).toContain(en.fs15.banner.body.slice(0, 40));
    await waitFor(() => expect(Array.from(screen.getByTestId('m18-fs15').querySelectorAll('button[data-testid^="benchmark-chip-"]')).map((x) => x.getAttribute('data-testid'))).toEqual(['benchmark-chip-SG-CAREER', 'benchmark-chip-CORP']), T);
    // k-ro's shortlist is full (3), so "Shortlist" is disabled on concept cards
    expect((within(bwr).getByTestId('m18-fs15-add') as HTMLButtonElement).disabled).toBe(true);
    // current moves carry transition evidence and the outlook label
    const moves = await screen.findByTestId('m18-moves', {}, T);
    await waitFor(() => expect(within(moves).getAllByTestId('m18-fs15-transition').length).toBeGreaterThan(0), T);
    await waitFor(() => expect(within(moves).getAllByTestId('m18-fs16-label').length).toBeGreaterThan(0), T);
    // the drawer for a concept role
    fireEvent.click(within(bwr).getByTestId('m18-fs15-details'));
    const detail = await screen.findByTestId('m18-fs15-detail', {}, T);
    expect(within(detail).getByTestId('m18-fs15-detail-gaps')).toBeTruthy();
  });

  it('a removed target frees a slot and the concept role can be shortlisted from its card', async () => {
    await renderPage(<MyCareerPage />, { path: '/my/career', persona: 'k-ro' });
    const shortlist = await screen.findByTestId('m18-shortlist', {}, T);
    fireEvent.click(within(shortlist).getAllByTestId('m18-short-remove')[2]);
    const list = await screen.findByTestId('m18-fs15-list', {}, T);
    const bwr = () => within(list).getAllByTestId('m18-fs15-card').find((c) => c.getAttribute('data-role') === 'fr-bwr-operator')!;
    await waitFor(() => expect((within(bwr()).getByTestId('m18-fs15-add') as HTMLButtonElement).disabled).toBe(false), T);
    fireEvent.click(within(bwr()).getByTestId('m18-fs15-add'));
    await waitFor(() => expect(screen.getByTestId('m18-shortlist').querySelector('[data-concept="true"]')).toBeTruthy(), T);
  });

  it('renders in Arabic', async () => {
    await renderPage(<MyCareerPage />, { path: '/ar/my/career', persona: 'k-ro' });
    await screen.findByTestId('m18-fs15-list', {}, T);
    expect(screen.getByText(ar.fs15.title)).toBeTruthy();
    expect(screen.getAllByTestId('m18-fs15-concept-chip')[0].textContent).toBe(ar.fs15.conceptChip);
  });
});

describe('/my/career/roadmap with a concept target (FS15)', () => {
  it('shows the concept banner, the concept option and a bridge-learning block ending in "profile-ready"', async () => {
    await renderPage(<MyRoadmapPage />, { path: '/my/career/roadmap?role=fr-bwr-operator', persona: 'k-ro' });
    const box = await screen.findByTestId('m18-rm-concept', {}, T);
    expect(within(box).getByTestId('m18-fs15-banner')).toBeTruthy();
    await waitFor(() => expect(within(box).getByTestId('m18-fs15-band')).toBeTruthy(), T);
    const gantt = await screen.findByTestId('m18-gantt', {}, T);
    await waitFor(() => expect(gantt.querySelector('[data-kind="bridge"]')).toBeTruthy(), T);
    const opts = Array.from(screen.getByTestId('m18-rm-form').querySelectorAll('option')).map((o) => o.textContent ?? '');
    expect(opts.some((o) => o.includes(en.fs15.conceptChip))).toBe(true);
  });
});

describe('/careers/outlook-criteria (FS16)', () => {
  it('public: lists every threshold, both criteria versions and 25 role labels; no components and no headcount', async () => {
    await renderPage(<CareersOutlookCriteriaPage />, { path: '/careers/outlook-criteria' });
    const th = await screen.findByTestId('m18-fs16-thresholds', {}, T);
    expect(Array.from(th.querySelectorAll('tbody tr')).map((r) => r.getAttribute('data-key'))).toEqual(['change_min_pct', 'growth_min_pct', 'shortfall_min_pct']);
    expect(th.textContent).toContain('30%');
    expect(th.textContent).toContain('5%');
    expect(within(screen.getByTestId('m18-fs16-rules')).getAllByRole('listitem')).toHaveLength(3);
    expect(within(screen.getByTestId('m18-fs16-versions')).getAllByTestId('m18-fs16-version')).toHaveLength(2);
    const table = screen.getByTestId('m18-fs16-table');
    await waitFor(() => expect(within(table).getAllByTestId('m18-fs16-row')).toHaveLength(25), T);
    expect(table.querySelectorAll('thead th')).toHaveLength(3); // role, label, history: no component columns
    expect(screen.queryByTestId('m18-fs16-why')).toBeNull();
    expect(screen.queryByTestId('m18-fs16-hr')).toBeNull();
    expect(within(table).getAllByTestId('m18-fs16-trail')[0].children).toHaveLength(3); // 2024, 2025, 2026 kept
    const text = document.body.textContent ?? '';
    expect(publicTextIsClean([text])).toBe(true);
    expect(text).not.toMatch(/headcount|people-equivalent/i);
    await waitFor(() => expect(Array.from(screen.getAllByTestId('benchmark-chips')[0].querySelectorAll('button[data-testid^="benchmark-chip-"]')).map((x) => x.getAttribute('data-testid'))).toEqual(['benchmark-chip-ONET', 'benchmark-chip-CORP', 'benchmark-chip-FORECAST']), T);
    // a past year
    fireEvent.click(within(screen.getByTestId('m18-fs16-years')).getAllByRole('button')[0]);
    await waitFor(() => expect(within(screen.getByTestId('m18-fs16-table')).getAllByTestId('m18-fs16-row').every((r) => ['growing', 'stable'].includes(r.getAttribute('data-label') ?? ''))).toBe(true), T);
  });

  it('staff see the components and "Why this label?"; the HR director previews this year\'s labels', async () => {
    await renderPage(<CareersOutlookCriteriaPage />, { path: '/careers/outlook-criteria', persona: 'chco' });
    const table = await screen.findByTestId('m18-fs16-table', {}, T);
    await waitFor(() => expect(table.querySelectorAll('thead th')).toHaveLength(6), T);
    expect(within(table).getAllByTestId('m18-fs16-why').length).toBe(25);
    fireEvent.click(screen.getByTestId('m18-fs16-preview'));
    const res = await screen.findByTestId('m18-fs16-preview-result', {}, T);
    expect(res.textContent).toMatch(new RegExp(en.fs16.label.growing));
    expect((screen.getByTestId('m18-fs16-publish') as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders in Arabic', async () => {
    await renderPage(<CareersOutlookCriteriaPage />, { path: '/ar/careers/outlook-criteria' });
    await screen.findByTestId('m18-fs16-thresholds', {}, T);
    expect(screen.getByText(ar.fs16.howTitle)).toBeTruthy();
    expect(screen.getAllByTestId('m18-fs16-tile').map((x) => x.textContent ?? '').join(' ')).toContain(ar.fs16.label.growing);
  });
});
