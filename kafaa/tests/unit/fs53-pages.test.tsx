// @vitest-environment jsdom
/** FS44/FS45 pages rendered with the real providers and the in-memory LocalBackend: the lecture library (tiles, filters, chips, synthetic
 *  label), my lectures and contributions with "why this", recording a lecture end to end (and a security refusal), a lecture page (chapters,
 *  protected position, KLRA link only for KLRA readers), the review page (publish, validate with evidence), the localisation countdown for
 *  the training manager (edit with confirm) and for staff (no names, no edit) in English and Arabic, and the F22 overdue panel. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import LecturesPage from '../../src/modules/m24/LecturesPage';
import LecturePage from '../../src/modules/m24/LecturePage';
import ContributionsPage from '../../src/modules/m24/ContributionsPage';
import LocalisationPage from '../../src/modules/m24/LocalisationPage';
import { LocalisationOverduePanel } from '../../src/modules/m24/links';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const W = { timeout: 30000 };
const raw = (t: string) => getLocalBackend().raw(t as never) as unknown as Row[];

describe('FS44/FS45 pages', () => {
  it('the library shows the published lectures with tiles, the synthetic label, format filters and the FS44 chips', async () => {
    await renderPage(<LecturesPage />, { persona: 'nse', path: '/knowledge/lectures' });
    const list = await screen.findByTestId('m24-lc-list', {}, { timeout: 90000 });
    const n = raw('lectures').filter((l) => l.status === 'published').length;
    expect(within(list).getAllByTestId('m24-lc-card').length).toBe(n);
    expect(within(list).getAllByTestId('m24-lc-protects').length).toBe(n - 1);
    expect(screen.getByTestId('m24-lc-synthetic').textContent).toMatch(/synthetic/i);
    expect(screen.getByTestId('m24-lc-sources').textContent).toMatch(/Plan 2035/);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-NEA')).toBeTruthy(), W);
    expect(screen.getByTestId('benchmark-chip-SKILLS-TECH')).toBeTruthy();
    fireEvent.click(screen.getByTestId('m24-lc-format-masterclass'));
    expect(within(screen.getByTestId('m24-lc-list')).getAllByTestId('m24-lc-card').every((c) => ['lec-001', 'lec-006'].includes(c.getAttribute('data-id')!))).toBe(true);
    expect(screen.queryByTestId('m24-lc-to-review')).toBeNull();
  }, 150000);
  it('"Mine" shows my lectures and contributions with their status and why they count (SME reviewer: one validated, one pending)', async () => {
    await renderPage(<LecturesPage />, { persona: 'sme-reviewer', path: '/knowledge/lectures?tab=mine' });
    const tbl = await screen.findByTestId('m24-lc-mine-ctb', {}, W);
    const st = within(tbl).getAllByTestId('m24-lc-mine-status').map((x) => x.getAttribute('data-status')).sort();
    expect(st).toEqual(['pending', 'validated']);
    expect(screen.getByTestId('m24-lc-how').textContent).toMatch(/validates/);
    fireEvent.click(within(tbl).getAllByTestId('m24-lc-mine-why')[0]);
    expect((await screen.findByTestId('m24-lc-mine-why-panel')).textContent!.length).toBeGreaterThan(10);
  }, 60000);
  it('recording a lecture: a security topic is refused in the form; a clean one is submitted after the confirmation', async () => {
    await renderPage(<LecturesPage />, { persona: 'nse', path: '/knowledge/lectures' });
    fireEvent.click(await screen.findByTestId('m24-lc-new', {}, W));
    const form = await screen.findByTestId('m24-lc-form', {}, W);
    const set = (id: string, v: string) => fireEvent.change(within(form).getByTestId(id), { target: { value: v } });
    set('m24-lc-f-title_en', 'Specification lessons for digital procurement');
    set('m24-lc-f-title_ar', 'دروس المواصفات للشراء الرقمي');
    set('m24-lc-f-abstract_en', 'How a specification engineer checks supplier documents that arrive through a digital portal, and what still needs eyes on the item.');
    set('m24-lc-f-abstract_ar', 'كيف يتحقق مهندس المواصفات من وثائق الموردين الواردة عبر بوابة رقمية، وما الذي لا يزال يحتاج إلى فحص القطعة نفسها.');
    set('m24-lc-f-date', '2026-09-20');
    fireEvent.click(within(within(form).getByTestId('m24-lc-f-skills')).getAllByRole('checkbox')[0]);
    set('m24-lc-f-title_en', 'Walking the perimeter during an outage');
    fireEvent.click(screen.getByTestId('m24-lc-f-submit'));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
    const err = await screen.findByTestId('m24-lc-f-error', {}, W);
    expect(err.getAttribute('data-code')).toBe('security_restricted');
    set('m24-lc-f-title_en', 'Specification lessons for digital procurement');
    fireEvent.click(screen.getByTestId('m24-lc-f-submit'));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
    await waitFor(() => expect(raw('lectures').some((l) => l.title_en === 'Specification lessons for digital procurement' && l.status === 'review' && l.speaker_id === 'p-nse' && l.position_id === 'pos-p-nse')).toBe(true), W);
  }, 90000);
  it('a lecture page shows the chapters and the protected position; the KLRA link appears only for KLRA readers', async () => {
    await renderPage(<LecturePage />, { persona: 'nse', path: '/knowledge/lectures/lec-001', route: '/knowledge/lectures/:lectureId' });
    expect((await screen.findByTestId('m24-lc-chapters', {}, W)).querySelectorAll('li').length).toBe(4);
    expect(screen.getByTestId('m24-lc-position').textContent).toMatch(/Protects/);
    expect(screen.queryByTestId('m24-lc-klra-link')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-NEA')).toBeTruthy(), W);
    await renderPage(<LecturePage />, { persona: 'training-mgr', path: '/knowledge/lectures/lec-001', route: '/knowledge/lectures/:lectureId' });
    expect(await screen.findByTestId('m24-lc-klra-link', {}, W)).toBeTruthy();
  }, 60000);
  it('the review page: the KM owner publishes a submitted lecture and validates a contribution, which writes evidence', async () => {
    await renderPage(<ContributionsPage />, { persona: 'training-mgr', path: '/knowledge/contributions' });
    const review = await screen.findByTestId('m24-ctb-review', {}, W);
    expect(within(review).getAllByTestId('m24-ctb-review-item').length).toBe(2);
    fireEvent.click(within(within(review).getAllByTestId('m24-ctb-review-item').find((x) => x.getAttribute('data-id') === 'lec-014')!).getByTestId('m24-ctb-publish'));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
    await waitFor(() => expect(raw('lectures').find((l) => l.id === 'lec-014')!.status).toBe('published'), W);
    fireEvent.click(screen.getByRole('tab', { name: /Contributions to validate/ }));
    const pending = await screen.findByTestId('m24-ctb-pending', {}, W);
    const item = within(pending).getAllByTestId('m24-ctb-item').find((x) => x.getAttribute('data-id') === 'ctb-lec-010')!;
    expect(within(item).getAllByTestId('m24-ctb-skills')[0].querySelectorAll('[data-evidence="yes"]').length).toBe(1);
    fireEvent.click(within(item).getByTestId('m24-ctb-validate'));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
    await waitFor(() => expect(raw('skill_evidence').some((e) => e.id === 'se:contrib:ctb-lec-010:sk-fs-adv-fuelcycle' && e.kind === 'rating' && e.basis === 'validated')).toBe(true), W);
    await waitFor(() => expect(raw('person_skills').some((s) => s.id === 'ps:p-nse:sk-fs-adv-fuelcycle' && s.active && s.level === 3)).toBe(true), W);
  }, 90000);
  it('the localisation countdown for the training manager: countdown, overdue items, readiness bars with reasons and a confirmed status update', async () => {
    await renderPage(<LocalisationPage />, { persona: 'training-mgr', path: '/knowledge/localisation' });
    const tbl = await screen.findByTestId('m24-lz-table', {}, W);
    const rows = within(tbl).getAllByTestId('m24-lz-row');
    expect(rows.length).toBe(raw('localisation_items').length);
    expect(Number(screen.getByTestId('m24-lz-countdown').getAttribute('data-days'))).toBeGreaterThan(0);
    expect(within(screen.getByTestId('m24-lz-overdue')).getAllByRole('listitem').length).toBeGreaterThanOrEqual(2);
    expect(rows.filter((r) => r.getAttribute('data-overdue') === 'yes').length).toBeGreaterThanOrEqual(2);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-NUC-NET')).toBeTruthy(), W);
    expect(screen.getByTestId('benchmark-chip-IAEA-WFP')).toBeTruthy();
    fireEvent.click(within(tbl).getAllByTestId('m24-lz-why')[0]);
    expect((await screen.findByTestId('m24-lz-why-panel')).textContent).toMatch(/in-house instructors/);
    const target = rows.find((r) => r.getAttribute('data-id') === 'loc-qa-auditor')!.closest('tr')!;
    fireEvent.click(within(target).getByTestId('m24-lz-edit'));
    fireEvent.change(await screen.findByTestId('m24-lz-status', {}, W), { target: { value: 'transferred' } });
    fireEvent.change(screen.getByTestId('m24-lz-note'), { target: { value: 'Partner countersignature no longer needed' } });
    fireEvent.click(screen.getByTestId('m24-lz-save'));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
    await waitFor(() => expect(raw('localisation_items').find((i) => i.id === 'loc-qa-auditor')!.status).toBe('transferred'), W);
  }, 90000);
  it('staff see the countdown in Arabic without instructor names or edit buttons', async () => {
    await renderPage(<LocalisationPage />, { persona: 'nse', path: '/ar/knowledge/localisation' });
    await screen.findByTestId('m24-lz-table', {}, W);
    expect(screen.queryAllByTestId('m24-lz-edit').length).toBe(0);
    expect(screen.queryAllByTestId('m24-lz-people').length).toBe(0);
    expect(document.body.textContent).toContain('العد التنازلي للتوطين');
    expect(document.body.textContent).toContain('خطة نموذجية');
  }, 60000);
  it('the F22 handover panel lists the overdue localisation items for HR', async () => {
    await renderPage(<LocalisationOverduePanel />, { persona: 'chco', path: '/workforce/handover' });
    const panel = await screen.findByTestId('m24-lz-handover-panel', {}, W);
    expect(within(panel).getAllByTestId('m24-lz-handover-item').map((x) => x.getAttribute('data-id')).sort()).toEqual(['loc-loit-watch', 'loc-rp-initial']);
  }, 60000);
});
