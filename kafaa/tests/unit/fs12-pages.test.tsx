// @vitest-environment jsdom
/** FS03 pages with the real providers and the in-memory LocalBackend: "How sure are we" (bands, the multi-source record, the decay
 *  projection, what would raise it, benchmarks, the method banner), the passport's band column and drawer, the Navigator readiness tile
 *  band (acceptance 3), the engine owners' page (preview, confirmed change, recompute, back-fill status), and Arabic. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import MyConfidencePage from '../../src/modules/m17/MyConfidencePage';
import SkillsConfidenceAdminPage from '../../src/modules/m17/SkillsConfidenceAdminPage';
import MySkillsPage from '../../src/modules/m17/MySkillsPage';
import MyCareerPage from '../../src/modules/m18/MyCareerPage';

const W = { timeout: 20000 };

describe('FS03 /my/skills/confidence', { timeout: 90000 }, () => {
  it('lists every skill with its band and range, opens the record, projection and actions', async () => {
    await renderPage(<MyConfidencePage />, { persona: 'k-ro', path: '/my/skills/confidence' });
    const table = await screen.findByTestId('m17-conf-table', {}, W);
    const rows = within(table).getAllByTestId('m17-conf-row');
    expect(rows.length).toBeGreaterThan(10);
    expect(new Set(rows.map((r) => r.getAttribute('data-band')))).toEqual(new Set(['low', 'medium', 'high']));
    expect(screen.getByTestId('m17-method-banner')).toBeTruthy();
    await waitFor(() => expect(Array.from(screen.getByTestId('m17-benchmarks').querySelectorAll('button[data-testid^="benchmark-chip-"]')).map((x) => x.getAttribute('data-testid'))).toEqual(['benchmark-chip-WEF-FOJ', 'benchmark-chip-SKILLS-TECH', 'benchmark-chip-FORECAST'])); // FS01 shared chips
    expect(screen.getAllByTestId('m17-decay-class').length).toBe(3);
    expect(screen.getAllByTestId('m17-decay-fact').length).toBeGreaterThan(1);
    const low = rows.find((r) => r.getAttribute('data-band') === 'low')!;
    fireEvent.click(within(low).getByText('Details'));
    const d = await screen.findByTestId('m17-conf-drawer', {}, W);
    expect(within(d).getAllByTestId('m17-source').length).toBeGreaterThan(0);
    expect(within(d).getByTestId('m17-conf-projection')).toBeTruthy();
    expect(within(d).getAllByTestId('m17-conf-action').length).toBeGreaterThan(0);
  });
  it('filters by band', async () => {
    await renderPage(<MyConfidencePage />, { persona: 'k-ro', path: '/my/skills/confidence?band=high' });
    const rows = await screen.findAllByTestId('m17-conf-row', {}, W);
    expect(rows.every((r) => r.getAttribute('data-band') === 'high')).toBe(true);
  });
  it('renders in Arabic', async () => {
    await renderPage(<MyConfidencePage />, { persona: 'k-ro', path: '/ar/my/skills/confidence' });
    await screen.findByTestId('m17-conf-table', {}, W);
    expect(document.body.textContent).toMatch(/مرتفع|متوسط|منخفض/);
    expect(document.body.textContent).toMatch(/سريعة التغيّر/);
  });
});

describe('FS03 in the passport and the Navigator', { timeout: 90000 }, () => {
  it('the passport list shows a band per skill and the drawer shows the sources', async () => {
    await renderPage(<MySkillsPage />, { persona: 'k-ro', path: '/my/skills' });
    const table = await screen.findByTestId('m17-skills', {}, W);
    await waitFor(() => expect(within(table).getAllByTestId(/m17-passport-band-/).length).toBeGreaterThan(5), W);
    expect(screen.getByTestId('m17-to-confidence')).toBeTruthy();
    fireEvent.click(within(table).getAllByTestId(/m17-evidence-sk-/)[0]);
    const d = await screen.findByTestId('m17-evidence-drawer', {}, W);
    expect(within(d).getByTestId('m17-evidence-band')).toBeTruthy();
    expect(within(d).getByTestId('m17-evidence-sources')).toBeTruthy();
  });
  it('AC3: the Navigator readiness tile displays the band', async () => {
    await renderPage(<MyCareerPage />, { persona: 'k-ro', path: '/my/career' });
    const tiles = await screen.findAllByTestId('m18-readiness-sure', {}, W);
    expect(tiles.length).toBeGreaterThan(0);
    expect(['low', 'medium', 'high']).toContain(tiles[0].getAttribute('data-band'));
    expect(within(tiles[0]).getByTestId('m18-readiness-band')).toBeTruthy();
  });
});

describe('FS03 /admin/skills-confidence', { timeout: 90000 }, () => {
  it('shows half-lives, curves, distributions and back-fill; an admin previews then changes the half-lives (confirmed)', async () => {
    await renderPage(<SkillsConfidenceAdminPage />, { persona: 'ai-governance', path: '/admin/skills-confidence' });
    await screen.findByTestId('m17-adm-tiles', {}, W);
    expect(screen.getByTestId('m17-adm-curves')).toBeTruthy();
    expect(screen.getByTestId('m17-adm-by-class')).toBeTruthy();
    expect(screen.getByTestId('m17-adm-by-area').querySelector('[data-suppressed="yes"]')).toBeTruthy();
    expect(screen.getByTestId('m17-adm-backfill').getAttribute('data-missing')).toBe('0');
    const ed = screen.getByTestId('m17-adm-editor');
    const std = within(ed).getByLabelText(/Standard/);
    fireEvent.change(std, { target: { value: '24' } });
    fireEvent.click(within(ed).getByTestId('m17-adm-preview'));
    const card = await screen.findByTestId('m17-adm-preview-card', {}, W);
    expect(card.textContent).toMatch(/States changing band/);
    expect(document.body.textContent).toMatch(/Preview: fast 18, standard 24, slow 60 months/);
    fireEvent.change(within(screen.getByTestId('m17-adm-editor')).getByLabelText(/Why change it/), { target: { value: 'Procedures were revised: evidence ages faster' } });
    fireEvent.click(screen.getByTestId('m17-adm-save'));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
    await waitFor(() => expect(screen.getByTestId('m17-adm-last').textContent).toMatch(/Procedures were revised/), W);
  });
  it('refuses an out-of-range half-life in the form; the training manager can recompute but not change', async () => {
    await renderPage(<SkillsConfidenceAdminPage />, { persona: 'training-mgr', path: '/admin/skills-confidence' });
    const ed = await screen.findByTestId('m17-adm-editor', {}, W);
    expect(screen.queryByTestId('m17-adm-save')).toBeNull();
    fireEvent.change(within(ed).getByLabelText(/Fast-changing/), { target: { value: '200' } });
    expect(await screen.findByTestId('m17-adm-invalid')).toBeTruthy();
    fireEvent.click(screen.getByTestId('m17-adm-recompute'));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
    expect(await screen.findByTestId('m17-adm-recomputed', {}, W)).toBeTruthy();
  });
  it('renders in Arabic', async () => {
    await renderPage(<SkillsConfidenceAdminPage />, { persona: 'k-hr-analyst', path: '/ar/admin/skills-confidence' });
    await screen.findByTestId('m17-adm-tiles', {}, W);
    expect(document.body.textContent).toMatch(/عمر النصف/);
  });
});
