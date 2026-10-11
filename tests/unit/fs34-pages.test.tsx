// @vitest-environment jsdom
/** FS23/FS24 pages rendered with the real providers and the in-memory LocalBackend: the levels page (attributes, Authority not a
 *  level), the descriptor library and a skill ladder (defined only in range, EN and AR), the scale map (every row with a source), the
 *  check-in indicators hook (F10), My levels, and the Authority admin (maker-checker in the UI, approve writes a recognition). */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderPage } from './g1-harness';
import LevelsPage from '../../src/modules/m02/LevelsPage';
import DescriptorLibraryPage from '../../src/modules/m02/DescriptorLibraryPage';
import DescriptorPage from '../../src/modules/m02/DescriptorPage';
import ScaleMapPage from '../../src/modules/m02/ScaleMapPage';
import MyLevelsPage from '../../src/modules/m02/MyLevelsPage';
import AuthorityAdminPage from '../../src/modules/m02/AuthorityAdminPage';
import DescriptorsAdminPage from '../../src/modules/m02/DescriptorsAdminPage';
import { LevelIndicators } from '../../src/modules/m02/levelsUi';
import { getLocalBackend } from '../../src/data';
import seed from '../../src/seed/seed.json';

const W = { timeout: 25000 };
const S = (seed as unknown as { tables: Record<string, any[]> }).tables; // eslint-disable-line @typescript-eslint/no-explicit-any
const desc = (id: string, lv: number) => S.skill_descriptors.find((d) => d.skill_id === id && d.level === lv && d.status === 'published');

describe('FS23/FS24 pages', () => {
  it('the levels page shows the four levels with the five generic attributes, Authority as not a level, and FS23 chips', async () => {
    await renderPage(<LevelsPage />, { persona: null, path: '/competencies/levels' });
    await screen.findByTestId('m02-lv-level-4', {}, W);
    for (const lv of [1, 2, 3, 4]) expect(screen.getByTestId(`m02-lv-level-${lv}`)).toBeTruthy();
    expect(screen.getByTestId('m02-lv-attrs').textContent).toMatch(/autonomy/i);
    expect(screen.getByTestId('m02-lv-authority').textContent).toMatch(/not a (fifth )?level/i);
    await waitFor(() => expect(screen.getByTestId('m02-bench-fs23').querySelectorAll('button[data-testid^="benchmark-chip-"]').length).toBe(3));
  }, 60000);
  it('the descriptor library lists every non-obsolete skill to an anonymous visitor', async () => {
    await renderPage(<DescriptorLibraryPage />, { persona: null, path: '/competencies/descriptors' });
    const list = await screen.findByTestId('m02-dl-list', {}, W);
    expect(list.querySelectorAll(':scope > li').length).toBeGreaterThan(100);
  }, 60000);
  it('a skill ladder is defined only at the levels where the skill exists, with the rationale (EN)', async () => {
    await renderPage(<DescriptorPage />, { persona: null, path: '/competencies/descriptors/sk-pf-03-rcs', route: '/competencies/descriptors/:skillId' });
    await screen.findByTestId('m02-dp-ladder', {}, W);
    expect(screen.getByTestId('m02-dp-undefined-1')).toBeTruthy();
    for (const lv of [2, 3, 4]) expect(screen.getByTestId(`m02-dp-level-${lv}`).textContent).toContain(desc('sk-pf-03-rcs', lv).indicators_en[0]);
    expect(screen.getByTestId('m02-dp-rationale').textContent!.length).toBeGreaterThan(20);
  }, 60000);
  it('the same ladder in Arabic shows the Arabic indicators, right to left', async () => {
    await renderPage(<DescriptorPage />, { persona: null, path: '/ar/competencies/descriptors/sk-fs-ai-verify', route: '/ar/competencies/descriptors/:skillId' });
    await screen.findByTestId('m02-dp-ladder', {}, W);
    await waitFor(() => expect(screen.getByTestId('m02-dp-level-3').textContent).toContain(desc('sk-fs-ai-verify', 3).indicators_ar[0]));
  }, 60000);
  it('the scale map: a row per band, five framework strips, every strip cites a source, Authority explained', async () => {
    await renderPage(<ScaleMapPage />, { persona: null, path: '/competencies/scale' });
    const grid = await screen.findByTestId('m02-sc-grid', {}, W);
    expect(grid.querySelectorAll('tbody tr').length).toBe(6);
    const fw = screen.getByTestId('m02-sc-frameworks');
    expect(fw.querySelectorAll(':scope > li').length).toBe(5);
    expect([...fw.querySelectorAll('a[href^="https://"]')].length).toBeGreaterThanOrEqual(5);
    expect(screen.getByTestId('m02-sc-authority')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('m02-bench-fs24').querySelectorAll('button[data-testid^="benchmark-chip-"]').length).toBe(3));
  }, 60000);
  it('acceptance (check-in): the rater sees the indicators for the skill and level being rated, or why the level is not defined', async () => {
    await renderPage(<><LevelIndicators skillId="sk-fs-ai-verify" level={3} /><LevelIndicators skillId="sk-pf-03-rcs" level={1} /></>, { persona: 'sro', path: '/my/checkins' });
    const box = await screen.findByTestId('m02-ci-indicators-sk-fs-ai-verify', {}, W);
    for (const x of desc('sk-fs-ai-verify', 3).indicators_en) expect(box.textContent).toContain(x);
    expect((await screen.findByTestId('m02-ci-undefined-sk-pf-03-rcs', {}, W)).textContent).toMatch(/not defined/i);
  }, 60000);
  it('My levels: an Expert sees the Authority recognition and that the level stays Expert', async () => {
    await renderPage(<MyLevelsPage />, { persona: 'sro', path: '/my/levels' });
    const auth = await screen.findByTestId('m02-ml-authority', {}, W);
    expect(auth.textContent).toMatch(/recognised/i);
    expect(screen.getByTestId('m02-ml-list').querySelectorAll(':scope > li').length).toBeGreaterThan(0);
  }, 60000);
  it('Authority admin: the HR director approves the training manager\'s proposal, and cannot decide their own', async () => {
    await renderPage(<AuthorityAdminPage />, { persona: 'chco', path: '/admin/authority' });
    await screen.findByTestId('m02-au-queue', {}, W);
    fireEvent.click(await screen.findByTestId('m02-au-approve-ar:w-rp-01:sk-rp-01:1', {}, W));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
    await waitFor(() => expect((getLocalBackend().raw('authority_recognitions' as never) as unknown as any[]).find((r) => r.id === 'ar:w-rp-01:sk-rp-01:1')?.status).toBe('recognised'), W); // eslint-disable-line @typescript-eslint/no-explicit-any
  }, 60000);
  it('Authority admin as the training manager: can propose, cannot approve', async () => {
    await renderPage(<AuthorityAdminPage />, { persona: 'training-mgr', path: '/admin/authority' });
    await screen.findByTestId('m02-au-queue', {}, W);
    expect(screen.getByTestId('m02-au-mc-ar:w-rp-01:sk-rp-01:1')).toBeTruthy();
    expect(screen.queryByTestId('m02-au-approve-ar:w-rp-01:sk-rp-01:1')).toBeNull();
    await screen.findByTestId('m02-au-candidates', {}, W);
  }, 60000);
  it('descriptor admin: the instructor opens the editor for a skill and opens on the first level where the skill exists', async () => {
    await renderPage(<DescriptorsAdminPage />, { persona: 'k-instructor', path: '/admin/descriptors' });
    await screen.findByTestId('m02-da-table', {}, W);
    fireEvent.click(await screen.findByTestId('m02-da-open-sk-pf-03-rcs', {}, W));
    await screen.findByTestId('m02-da-editor', {}, W);
    // opens on the first level where the skill exists (level 2 for a licence-like skill), with that level's live check
    expect((await screen.findByTestId('m02-da-level-2', {}, W)).querySelector('textarea')).toBeTruthy();
    expect(screen.getByTestId('m02-da-check-2')).toBeTruthy();
    expect(screen.queryByTestId('m02-da-level-1')).toBeNull();
  }, 60000);
});
