// @vitest-environment jsdom
/** FS62/FS63 pages rendered with the real providers and the in-memory LocalBackend: the alignment hub (six strategies, computed counts,
 *  flagged sources, the not-a-government-system statement), a tag page with its bilingual definition, sources, items and <WhyThis>, the
 *  report builder (filters, measures for HR only, CSV/JSON export), the maintenance page (live checks before the confirmation) and the
 *  occupation mapping ("code pending review", not a MoHRE system, the SIMULATED trend for HR only). Every page shows its benchmark chips. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import NationalAlignmentPage from '../../src/modules/m37/NationalAlignmentPage';
import NationalTagPage from '../../src/modules/m37/NationalTagPage';
import NationalReportPage from '../../src/modules/m37/NationalReportPage';
import AdminNationalTagsPage from '../../src/modules/m37/AdminNationalTagsPage';
import NationalOccupationsPage from '../../src/modules/m37/NationalOccupationsPage';

const W = { timeout: 60000 };

describe('FS62/FS63 pages', () => {
  it('the hub shows the six strategies with computed counts, flagged sources, the coverage matrix and the FS62 chips (HR director)', async () => {
    await renderPage(<NationalAlignmentPage />, { persona: 'chco', path: '/national/alignment' });
    await waitFor(() => expect(screen.getAllByTestId('m37-hub-strategy').length).toBe(6), { timeout: 120000 });
    expect(screen.getAllByTestId('m37-hub-reach').length).toBe(6);
    expect(screen.getAllByTestId('m37-source-flag').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByTestId('m37-not-gov')).toBeTruthy();
    expect(screen.getByTestId('m37-hub-matrix')).toBeTruthy();
    expect(screen.getByTestId('m37-hub-admin')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-JAHIZ')).toBeTruthy(), W);
    expect(screen.getByTestId('benchmark-chip-UAE-AI')).toBeTruthy();
    expect(screen.getByTestId('benchmark-chip-NAFIS')).toBeTruthy();
  }, 180000);
  it('staff see the hub without people counts and without the maintenance link (reactor operator)', async () => {
    await renderPage(<NationalAlignmentPage />, { persona: 'k-ro', path: '/national/alignment' });
    await waitFor(() => expect(screen.getAllByTestId('m37-hub-strategy').length).toBe(6), W);
    expect(screen.queryAllByTestId('m37-hub-reach').length).toBe(0);
    expect(screen.queryByTestId('m37-hub-admin')).toBeNull();
  }, 120000);
  it('a tag page: EN and AR side by side, sources with tiers, items with WhyThis and measures for HR', async () => {
    await renderPage(<NationalTagPage />, { persona: 'k-hr-analyst', path: '/national/alignment/nt-ai-2031', route: '/national/alignment/:tagId' });
    const tag = await screen.findByTestId('m37-tag', {}, W);
    expect(tag.getAttribute('data-flagged')).toBe('false');
    expect(within(screen.getByTestId('m37-tag-bilingual')).getByText('الاستراتيجية الوطنية للذكاء الاصطناعي 2031')).toBeTruthy();
    expect(screen.getByTestId('m37-sources').querySelectorAll('li').length).toBe(3);
    const report = await screen.findByTestId('m37-report', {}, W);
    expect(report.getAttribute('data-measures')).toBe('true');
    expect(Number(report.getAttribute('data-items'))).toBeGreaterThan(5);
    fireEvent.click(screen.getAllByTestId('m37-why')[0]);
    expect((await screen.findByTestId('m37-why-panel')).textContent).toMatch(/Linked by|Derived from the data/);
    expect(screen.getAllByTestId('m37-measure').length).toBeGreaterThan(0);
  }, 120000);
  it('a flagged tag says why it must be re-checked (We the UAE 2031), in Arabic', async () => {
    await renderPage(<NationalTagPage />, { persona: 'sro', path: '/ar/national/alignment/nt-we-uae-2031', route: '/ar/national/alignment/:tagId' });
    const tag = await screen.findByTestId('m37-tag', {}, W);
    expect(tag.getAttribute('data-flagged')).toBe('true');
    expect(screen.getByTestId('m37-source-note').textContent).toMatch(/إسكوا/);
    const report = await screen.findByTestId('m37-report', {}, W);
    expect(report.getAttribute('data-measures')).toBe('false');
  }, 120000);
  it('the report builder filters by strategy and kind, recomputes the counts and exports what is shown', async () => {
    await renderPage(<NationalReportPage />, { persona: 'chco', path: '/national/report?strategy=net_zero_2050' });
    const report = await screen.findByTestId('m37-report', {}, W);
    const all = Number(report.getAttribute('data-items'));
    expect(all).toBeGreaterThan(10);
    const selects = within(screen.getByTestId('filter-bar')).getAllByRole('combobox');
    fireEvent.change(selects[2], { target: { value: 'target' } });
    await waitFor(() => expect(Number(screen.getByTestId('m37-report').getAttribute('data-items'))).toBeLessThan(all), W);
    expect(screen.getByTestId('m37-report-computed').textContent).toMatch(/computed from the data/);
    expect(screen.getByTestId('m37-export-csv')).toBeTruthy();
    expect(screen.getByTestId('m37-export-json')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-JAHIZ')).toBeTruthy(), W);
  }, 120000);
  it('the maintenance page runs the save checks live: a typed number in the summary blocks the save', async () => {
    await renderPage(<AdminNationalTagsPage />, { persona: 'chco', path: '/admin/national-tags' });
    fireEvent.click(await screen.findByTestId('m37-admin-new', {}, W));
    const editor = await screen.findByTestId('m37-tag-editor');
    expect(editor.getAttribute('data-problem')).toBe('code');
    const field = (name: string) => editor.querySelector(`[name="${name}"]`) as HTMLInputElement;
    fireEvent.change(field('m37-te-code'), { target: { value: 'NES-TEST' } });
    fireEvent.change(field('m37-te-name-en'), { target: { value: 'A test goal' } });
    fireEvent.change(field('m37-te-name-ar'), { target: { value: 'هدف تجريبي' } });
    fireEvent.change(field('m37-te-sum-en'), { target: { value: 'A goal that reaches 610,000 by 2031.' } });
    fireEvent.change(field('m37-te-sum-ar'), { target: { value: 'هدف تجريبي للتحقق من الفحوص المباشرة.' } });
    fireEvent.change(field('m37-te-src-label-0'), { target: { value: 'u.ae NES page' } });
    fireEvent.change(field('m37-te-src-url-0'), { target: { value: 'https://u.ae/about-the-uae' } });
    fireEvent.change(field('m37-te-src-asof-0'), { target: { value: '2026-10-10' } });
    await waitFor(() => expect(screen.getByTestId('m37-tag-editor').getAttribute('data-problem')).toBe('typed_total'));
    expect((screen.getByTestId('m37-tag-save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(field('m37-te-sum-en'), { target: { value: 'A goal added to check the live save checks.' } });
    await waitFor(() => expect(screen.getByTestId('m37-tag-editor').getAttribute('data-problem')).toBe(''));
    expect((screen.getByTestId('m37-tag-save') as HTMLButtonElement).disabled).toBe(false);
  }, 120000);
  it('the occupation mapping: 28 roles, every code pending review, the not-a-MoHRE statement, the SIMULATED trend for HR and the FS63 chips', async () => {
    await renderPage(<NationalOccupationsPage />, { persona: 'k-hr-analyst', path: '/national/occupations' });
    await waitFor(() => expect(screen.getAllByTestId('m37-ro-code').length).toBe(28), { timeout: 120000 });
    expect(screen.getAllByTestId('m37-ro-code').every((c) => c.getAttribute('data-status') === 'pending')).toBe(true);
    expect(screen.getByTestId('m37-not-mohre').textContent).toMatch(/does not issue, validate or submit/);
    const trend = await screen.findByTestId('m37-ro-trend', {}, W);
    expect(trend.getAttribute('data-simulated')).toBe('true');
    expect(screen.getByTestId('m37-ro-trend-table').querySelectorAll('[data-suppressed="true"]').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('m37-ro-verify').length).toBe(0);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-MOHRE')).toBeTruthy(), W);
    expect(screen.getByTestId('benchmark-chip-ESCO')).toBeTruthy();
  }, 180000);
  it('staff see the mapping without the trend; an admin sees the verify action', async () => {
    await renderPage(<NationalOccupationsPage />, { persona: 'sro', path: '/national/occupations' });
    await waitFor(() => expect(screen.getAllByTestId('m37-ro-code').length).toBe(28), W);
    expect(screen.queryByTestId('m37-ro-trend')).toBeNull();
    await renderPage(<NationalOccupationsPage />, { persona: 'k-admin', path: '/national/occupations' });
    await waitFor(() => expect(screen.getAllByTestId('m37-ro-verify').length).toBe(28), W);
  }, 120000);
});
