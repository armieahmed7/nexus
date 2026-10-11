// @vitest-environment jsdom
/** FS07/FS08 pages rendered with the real providers and the in-memory LocalBackend: the explorer (all published skills, filters, the
 *  Arabic search, why-this, obsolete hidden), a skill page (sources with as-of, level ladder, roles, crosswalk tab with indicative
 *  pills, signed-in overlay and "Add to my goals"), an obsolete skill by direct link, the frameworks page (coverage matrix, export
 *  valid against the CASE-shaped schema, per-framework list) and the admin editor (RBAC, live check, auditor read-only), in EN and AR. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import SkillsExplorerPage from '../../src/modules/m28/SkillsExplorerPage';
import SkillPage from '../../src/modules/m28/SkillPage';
import FrameworksPage from '../../src/modules/m28/FrameworksPage';
import AlignmentsAdminPage from '../../src/modules/m28/AlignmentsAdminPage';
import { isListed } from '../../src/modules/m28/explorer';
import { isIndicative } from '../../src/modules/m28/crosswalk';
import seed from '../../src/seed/seed.json';

const W = { timeout: 25000 };
const S = (seed as unknown as { tables: Record<string, any[]> }).tables; // eslint-disable-line @typescript-eslint/no-explicit-any
const nListed = S.skills.filter(isListed).length;

describe('FS07/FS08 pages', () => {
  it('the explorer lists every published skill to an anonymous visitor, with benchmark chips and no personal overlay', async () => {
    await renderPage(<SkillsExplorerPage />, { persona: null, path: '/skills' });
    const list = await screen.findByTestId('m28-skill-list', {}, W);
    expect(list.querySelectorAll(':scope > li').length).toBe(nListed);
    expect(screen.getByTestId('m28-count').textContent).toContain(String(nListed));
    await waitFor(() => expect(screen.getByTestId('m28-bench-fs07').querySelectorAll('button[data-testid^="benchmark-chip-"]').length).toBe(3));
    expect(screen.getByTestId('m28-obsolete-note').textContent).toMatch(/obsolete/i);
    expect(screen.queryByTestId('m28-card-held')).toBeNull();
    expect(screen.queryByTestId('m28-skill-sk-fs-dp-paperwp')).toBeNull();
  }, 60000);
  it('filters narrow the list (future-skills area from the URL)', async () => {
    await renderPage(<SkillsExplorerPage />, { persona: null, path: '/skills?future=ai_data' });
    const list = await screen.findByTestId('m28-skill-list', {}, W);
    expect(list.querySelectorAll(':scope > li').length).toBe(S.skills.filter((s) => isListed(s) && s.fs_area === 'ai_data').length);
  }, 60000);
  it('the Arabic search finds the data-analysis skill first, with a reason', async () => {
    await renderPage(<SkillsExplorerPage />, { persona: null, path: '/skills' });
    await screen.findByTestId('m28-skill-list', {}, W);
    fireEvent.change(screen.getByTestId('m28-search'), { target: { value: 'تحليل البيانات' } });
    await waitFor(() => expect(screen.getByTestId('m28-skill-list').querySelector('li a')!.getAttribute('data-testid')).toBe('m28-skill-sk-da-01-analysis'));
    expect(screen.getByTestId('m28-why-sk-da-01-analysis')).toBeTruthy();
  }, 60000);
  it('a signed-in employee sees which skills they hold', async () => {
    await renderPage(<SkillsExplorerPage />, { persona: 'k-ro', path: '/skills' });
    await screen.findByTestId('m28-skill-list', {}, W);
    await waitFor(() => expect(screen.getAllByTestId('m28-card-held').length).toBe(S.person_skills.filter((p) => p.person_id === 'p-k-ro' && p.active && p.level > 0 && S.skills.find((s) => s.id === p.skill_id && isListed(s))).length));
  }, 60000);
  it('a skill page: chips, ladder with the key level, sources with as-of dates, roles in 2030, crosswalk with indicative/reviewed pills', async () => {
    await renderPage(<SkillPage />, { persona: null, path: '/skills/sk-fs-ai-verify?tab=sources', route: '/skills/:id' });
    const src = await screen.findByTestId('m28-skill-sources', {}, W);
    expect(src.querySelectorAll('li').length).toBeGreaterThanOrEqual(1);
    expect(src.textContent).toMatch(/read /);
    expect(src.querySelector('a[href^="https://"]')).toBeTruthy();
    expect(screen.getByTestId('m28-mine-anon')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /overview/i }));
    expect((await screen.findByTestId('m28-ladder')).querySelectorAll(':scope > li').length).toBe(4); // wave C QA: each level now also lists FS23 indicators
    expect(screen.getByTestId('m28-key-level').textContent).toContain(S.skills.find((s) => s.id === 'sk-fs-ai-verify').level_essence_en);
    fireEvent.click(screen.getByRole('tab', { name: /roles/i }));
    expect((await screen.findByTestId('m28-roles-2030', {}, W)).querySelectorAll('li').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: /crosswalk/i }));
    const xw = await screen.findByTestId('m28-crosswalk');
    const rows = S.skill_alignments.filter((a) => a.skill_id === 'sk-fs-ai-verify' && a.status === 'published');
    expect(within(xw).getAllByTestId('m28-xw-row').length).toBe(rows.length);
    expect(within(xw).queryAllByTestId('m28-indicative').length).toBe(rows.filter(isIndicative).length);
    expect(within(xw).queryAllByTestId('m28-code-pending').length).toBe(rows.filter((r) => !r.external_code).length);
    expect(screen.getByTestId('m28-match-legend')).toBeTruthy();
  }, 60000);
  it('in Arabic the crosswalk shows "إرشادي" for rows not yet reviewed and ESCO\'s own Arabic label', async () => {
    await renderPage(<SkillPage />, { persona: null, path: '/ar/skills/sk-fs-tr-analytical?tab=crosswalk', route: '/ar/skills/:id' });
    const xw = await screen.findByTestId('m28-crosswalk', {}, W);
    const rows = S.skill_alignments.filter((a) => a.skill_id === 'sk-fs-tr-analytical' && a.status === 'published');
    const ind = rows.filter(isIndicative).length;
    expect(ind).toBeGreaterThan(0);
    expect(within(xw).getAllByTestId('m28-indicative').length).toBe(ind);
    expect(xw.textContent).toContain('إرشادي');
    expect(xw.textContent).toContain(rows.find((r) => r.framework === 'esco').label_ar);
  }, 60000);
  it('signed in: "You hold this at L3 (verified)"; "Add to my goals" writes a goal', async () => {
    await renderPage(<SkillPage />, { persona: 'k-ro', path: '/skills/sk-co-01', route: '/skills/:id' });
    expect((await screen.findByTestId('m28-mine-held', {}, W)).textContent).toMatch(/You hold this at L3 \(verified\)/);
    fireEvent.click(screen.getByTestId('m28-goal-add'));
    await screen.findByTestId('m28-goal-remove', {}, W);
  }, 60000);
  it('an obsolete skill stays reachable by direct link with "obsolete since" and its replacement', async () => {
    await renderPage(<SkillPage />, { persona: null, path: '/skills/sk-fs-dp-paperwp', route: '/skills/:id' });
    expect((await screen.findByTestId('m28-obsolete', {}, W)).textContent).toMatch(/Replaced by/);
    expect(document.body.textContent).toMatch(/Obsolete since/);
  }, 60000);
  it('the frameworks page: tiles, coverage matrix, a gap list (UAE NQF), export valid against the schema, filtered list', async () => {
    await renderPage(<FrameworksPage />, { persona: null, path: '/skills/frameworks?fw=sfia9' });
    const tiles = await screen.findByTestId('m28-fw-tiles', {}, W);
    expect(tiles.textContent).toMatch(/100%/);
    expect(screen.getByTestId('m28-fw-cards').querySelectorAll(':scope > li').length).toBe(11);
    expect(within(screen.getByTestId('m28-fw-matrix')).getAllByRole('row').length).toBe(12);
    expect(screen.getByTestId('m28-fw-gaps').textContent).toContain('UAE NQF');
    expect(screen.getByTestId('m28-export-valid').textContent).toMatch(/validates/);
    expect(screen.getByTestId('m28-fw-table').querySelectorAll('tbody tr').length).toBe(Math.min(20, S.skill_alignments.filter((a) => a.framework === 'sfia9' && a.status === 'published').length));
    await waitFor(() => expect(screen.getByTestId('m28-bench-fs08').querySelectorAll('button[data-testid^="benchmark-chip-"]').length).toBe(6));
  }, 60000);
  it('the admin editor: framework owners add with a live check; the auditor reads every row without controls', async () => {
    await renderPage(<AlignmentsAdminPage />, { persona: 'training-mgr', path: '/admin/skills/alignments' });
    const tiles = await screen.findByTestId('m28-admin-tiles', {}, W);
    expect(tiles.textContent).toContain(String(S.skill_alignments.length));
    fireEvent.click(screen.getByTestId('m28-add'));
    expect(await screen.findByTestId('m28-editor')).toBeTruthy();
    expect(screen.getByTestId('m28-editor-problem').textContent).toMatch(/Choose a Kafa'a skill/);
    expect((screen.getByTestId('m28-editor-save') as HTMLButtonElement).disabled).toBe(true);
  }, 60000);
  it('the auditor reads the editor page read-only, drafts and retired rows included', async () => {
    await renderPage(<AlignmentsAdminPage />, { persona: 'k-auditor', path: '/admin/skills/alignments?ast=retired' });
    expect(await screen.findByTestId('m28-admin-readonly', {}, W)).toBeTruthy();
    expect(screen.queryByTestId('m28-add')).toBeNull();
    expect(screen.getByTestId('m28-admin-table').querySelectorAll('tbody tr').length).toBe(S.skill_alignments.filter((a) => a.status === 'retired').length);
  }, 60000);
  it('the explorer renders in Arabic', async () => {
    await renderPage(<SkillsExplorerPage />, { persona: null, path: '/ar/skills' });
    const tiles = await screen.findByTestId('m28-explorer-tiles', {}, W);
    expect(tiles.textContent).toMatch(/[؀-ۿ]/);
    expect(document.body.textContent).toContain('المهارات المنشورة');
  }, 60000);
});
