// @vitest-environment jsdom
/** FS11 / FS12 pages rendered with the real providers and the in-memory LocalBackend, in English and Arabic: My role in 2030 (map,
 *  time-to-ready with its gaps, bridge, timeline, benchmark chips), the task exposure view (three bands with reasons, complements,
 *  reference line), the public summary (no numbers, path-level for security roles), the HR overview (suppression) and the editor
 *  (live copy check, draft, publish). */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import MyRole2030Page from '../../src/modules/m30/MyRole2030Page';
import TaskExposurePage from '../../src/modules/m30/TaskExposurePage';
import CareersTransformationPage from '../../src/modules/m30/CareersTransformationPage';
import WorkforceTransformationPage from '../../src/modules/m30/WorkforceTransformationPage';
import TransformationEditPage from '../../src/modules/m30/TransformationEditPage';
import { getLocalBackend } from '../../src/data';

const T = { timeout: 25000 };
const chips = async (ids: string[]) => waitFor(() => expect(Array.from(screen.getAllByTestId('m30-bench')[0].querySelectorAll('button[data-testid^="benchmark-chip-"]')).map((x) => x.getAttribute('data-testid'))).toEqual(ids.map((i) => `benchmark-chip-${i}`)), T);

describe('FS11 / FS12 pages', () => {
  it('My role in 2030 (k-ro): drivers, the three task moves with reasons, skills added, bridge, my time-to-ready with gaps, timeline, FS11 chips', async () => {
    await renderPage(<MyRole2030Page />, { persona: 'k-ro', path: '/my/role-2030?h=2035' }); // [FS QA wave B] 2030 reads ready now after k-ro's fitness checks
    expect(await screen.findByTestId('m30-hero', {}, T)).toBeTruthy();
    await chips(['SG-JTM', 'SSG-SF', 'CORP']);
    expect(screen.getByTestId('m30-drivers').querySelectorAll('[data-testid="m30-driver"]').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m30-move-grow').querySelectorAll('li').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('m30-task-why').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m30-added').querySelectorAll('tbody tr').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m30-bridge').querySelectorAll('li').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m30-months').textContent).toMatch(/About 4 months/);
    expect(screen.getByTestId('m30-gaps').querySelectorAll('li').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('m30-ready-why'));
    expect(screen.getByTestId('m30-ready-why-panel').textContent).toMatch(/2 months per level/);
    expect(screen.getByTestId('m30-timeline').textContent).toMatch(/OSSA/);
    expect(screen.getByTestId('m30-archetype').textContent).toMatch(/practice|ladder/i);
    expect(screen.queryByTestId('m30-edit-link')).toBeNull();
  }, 60000);
  it('in Arabic, the training manager sees the open draft and the edit link', async () => {
    await renderPage(<MyRole2030Page />, { persona: 'training-mgr', path: '/ar/my/role-2030?role=reactor-operator' });
    expect(await screen.findByTestId('m30-draft-pending', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m30-edit-link')).toBeTruthy();
    expect(document.body.textContent).toMatch(/دوري في 2030|ينمو|تنمو/);
  }, 60000);
  it('a security role shows the career path only (no tasks, no time-to-ready)', async () => {
    await renderPage(<MyRole2030Page />, { persona: 'k-ro', path: '/my/role-2030?role=security-officer' });
    expect(await screen.findByTestId('m30-path-only', {}, T)).toBeTruthy();
    expect(screen.queryByTestId('m30-work')).toBeNull();
    expect(screen.queryByTestId('m30-gaps')).toBeNull();
  }, 60000);
  it('task exposure view: three bands, each task with its reason, skills that complement AI, the SSG reference line, FS12 chips', async () => {
    await renderPage(<TaskExposurePage />, { persona: 'k-ro', path: '/my/role-2030/tasks' });
    const bands = await screen.findByTestId('m30-bands', {}, T);
    await chips(['SSG-SF', 'OECD-AICI', 'ENERGY-JOBS']);
    const rows = within(bands).getAllByTestId('m30-band-reason');
    expect(rows.length).toBe(9);
    expect(rows.every((r) => (r.textContent ?? '').length > 10)).toBe(true);
    expect(screen.getByTestId('m30-complements').querySelectorAll('li').length).toBeGreaterThan(0);
    expect(screen.getByTestId('benchmark-line')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\breplac|redundan/i);
  }, 60000);
  it('the public summary has no numbers in its text and no headcount; a security role is path-level only', async () => {
    await renderPage(<CareersTransformationPage />, { path: '/careers/roles/reactor-operator/transformation', route: '/careers/roles/:slug/transformation' });
    const s = await screen.findByTestId('m30-pub-summary', {}, T);
    expect(s.textContent).not.toMatch(/[0-9]/);
    expect(Array.from((await screen.findByTestId('m30-pub-skills', {}, T)).querySelectorAll('li')).every((li) => !/[0-9]/.test(li.textContent ?? ''))).toBe(true);
    expect(screen.getByTestId('m30-public').textContent).not.toMatch(/%|\bmonths\b|[0-9]+ (people|staff|employees|positions)/i);
  }, 60000);
  it('the public page of a security role is path-level only (Arabic)', async () => {
    await renderPage(<CareersTransformationPage />, { path: '/ar/careers/roles/security-officer/transformation', route: '/ar/careers/roles/:slug/transformation' });
    expect(await screen.findByTestId('m30-path-only', {}, T)).toBeTruthy();
    expect(screen.queryByTestId('m30-pub-skills')).toBeNull();
  }, 60000);
  it('HR overview: maps for all 28 roles; readiness and exposure tabs suppress groups under 10 people', async () => {
    await renderPage(<WorkforceTransformationPage />, { persona: 'k-hr-analyst', path: '/workforce/transformation' });
    expect((await screen.findByTestId('m30-wf-tiles', {}, T)).textContent).toContain('28 / 28');
    expect(screen.getByTestId('m30-wf-maps').querySelectorAll('tbody tr').length).toBe(28);
    fireEvent.click(screen.getByRole('tab', { name: /Task exposure/ }));
    const ex = await screen.findByTestId('m30-wf-exposure', {}, T);
    expect(ex.querySelectorAll('tr[data-suppressed="true"]').length).toBeGreaterThan(0);
    expect(ex.querySelectorAll('tr[data-suppressed="false"]').length).toBeGreaterThan(0);
    expect(ex.textContent).not.toMatch(/Security/);
    fireEvent.click(screen.getByRole('tab', { name: /Readiness/ }));
    const rd = await screen.findByTestId('m30-wf-ready', {}, T);
    for (const tr of Array.from(rd.querySelectorAll('tr[data-suppressed="true"]'))) expect(tr.querySelectorAll('td.num').length).toBe(0);
  }, 60000);
  it('editor: live copy check flags banned wording, a clean draft saves, publish confirms and bumps the version', async () => {
    await renderPage(<TransformationEditPage />, { persona: 'training-mgr', path: '/workforce/transformation/chemistry-technician', route: '/workforce/transformation/:roleId' });
    await screen.findByTestId('m30-editor', {}, T);
    const en = screen.getByLabelText('Staff summary (English)') as HTMLTextAreaElement;
    const orig = en.value;
    fireEvent.change(en, { target: { value: `${orig} Analysers replace manual sampling.` } });
    expect(screen.getByTestId('m30-ed-banned').textContent).toMatch(/replace/);
    expect((screen.getByTestId('m30-ed-save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(en, { target: { value: `${orig} Analysers take on routine sampling.` } });
    expect(screen.queryByTestId('m30-ed-banned')).toBeNull();
    fireEvent.click(screen.getByTestId('m30-ed-save'));
    await waitFor(() => expect((getLocalBackend().raw('transformation_drafts' as never) as any[]).some((d) => d.role_id === 'chemistry-technician' && d.open)).toBe(true), T); // eslint-disable-line @typescript-eslint/no-explicit-any
    fireEvent.click(screen.getByTestId('m30-ed-publish'));
    const dlg = await screen.findByRole('dialog', {}, T);
    fireEvent.click(within(dlg).getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect((getLocalBackend().raw('role_transformations' as never) as any[]).find((d) => d.role_id === 'chemistry-technician').version).toBe(2), T); // eslint-disable-line @typescript-eslint/no-explicit-any
  }, 60000);
});
