// @vitest-environment jsdom
/** FS68 / FS69 pages with the real providers and the in-memory LocalBackend: the partner's own-organisation readiness, the ENEC view of
 *  every supplier (suppressed organisation without numbers, suggestions with "Why this?"), the contractor's pre-arrival share flow with
 *  the three consent gates, the evaluator queue, the shared-items view with the pre-check, expired links, and Arabic. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import FutureReadinessPage from '../../src/modules/m09/FutureReadinessPage';
import PrearrivalPage from '../../src/modules/m09/PrearrivalPage';
import PrearrivalQueuePage from '../../src/modules/m09/PrearrivalQueuePage';
import PrearrivalSharePage from '../../src/modules/m09/PrearrivalSharePage';

const W = { timeout: 15000 };
const confirm = async () => fireEvent.click(await screen.findByTestId('confirm-action', {}, W));

describe('FS68/FS69 pages', { timeout: 60000 }, () => {
  it('FS68 page: a partner admin sees only their own organisation with groups, future needs and suggestions with reasons', async () => {
    await renderPage(<FutureReadinessPage />, { persona: 'alnoor-gm', path: '/partner/workforce/future-readiness' });
    const org = await screen.findByTestId('m09-fr-org', {}, W);
    expect(screen.getAllByTestId('m09-fr-org').length).toBe(1);
    expect(org.getAttribute('data-org')).toBe('org-alnoor');
    expect(within(org).getAllByTestId('m09-fr-group').length).toBe(4);
    expect(within(org).getAllByTestId('m09-fr-role').length).toBe(2);
    expect(within(org).getAllByTestId('m09-fr-split').length).toBeGreaterThan(2);
    fireEvent.click(within(org).getAllByTestId('m09-fr-sug-why')[0]);
    expect((await screen.findByTestId('m09-fr-sug-why-panel', {}, W)).textContent).toMatch(/Evidences|course/);
    expect(screen.getByTestId('m09-fr-academy-gaps').textContent).toMatch(/No supplier academy course/);
    expect(document.body.textContent).toMatch(/EU Pact|UK Nuclear|SMR/);
  });

  it('FS68 page: ENEC supplier management sees every supplier; the organisation under 10 contractors shows no numbers', async () => {
    await renderPage(<FutureReadinessPage />, { persona: 'k-admin', path: '/admin/suppliers/future-readiness' });
    await screen.findByTestId('m09-fr-org', {}, W);
    expect(screen.getAllByRole('tab').length).toBe(3);
    fireEvent.click(screen.getByRole('tab', { name: /Gulf Hydro/ }));
    const org = await screen.findByTestId('m09-fr-suppressed', {}, W);
    const view = org.closest('[data-testid="m09-fr-org"]') as HTMLElement;
    expect(view.getAttribute('data-suppressed')).toBe('yes');
    expect(within(view).queryAllByTestId('m09-fr-split').length).toBe(0);
    expect(within(view).getAllByTestId('m09-fr-suggestion').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m09-fr-method').textContent).toMatch(/fewer than 10 contractors/);
  });

  it('FS69 page: a contractor creates a pre-arrival share through the three consent gates and sees the public check link', async () => {
    await renderPage(<PrearrivalPage />, { persona: 'k-contractor', path: '/partner/workforce/prearrival' });
    expect((await screen.findAllByTestId('m09-pa-row', {}, W)).length).toBe(1);
    expect(screen.getByTestId('m09-pa-summary').getAttribute('data-outlook')).toBeTruthy();
    fireEvent.click(screen.getByTestId('m09-pa-new'));
    const items = await screen.findByTestId('m09-pa-items', {}, W);
    const boxes = within(items).getAllByRole('checkbox');
    fireEvent.click(boxes[0]); fireEvent.click(boxes[1]);
    fireEvent.change(screen.getByLabelText(/^Label/), { target: { value: 'Unit 4 outage call-out' } });
    expect(within(screen.getByTestId('m09-pa-preview')).getAllByRole('listitem').length).toBe(2);
    expect((screen.getByTestId('m09-pa-submit') as HTMLButtonElement).disabled).toBe(true);
    for (const c of within(screen.getByTestId('m09-pa-consents')).getAllByRole('checkbox')) fireEvent.click(c);
    fireEvent.click(screen.getByTestId('m09-pa-submit'));
    await confirm();
    expect(await screen.findByTestId('m09-pa-created', {}, W)).toBeTruthy();
    await waitFor(() => expect(screen.getAllByTestId('m09-pa-row').length).toBe(2), W);
    expect(getLocalBackend().raw('prearrival_shares' as never).filter((r: { person_id: string }) => r.person_id === 'p-k-contractor').length).toBe(2);
  });

  it('FS69 queue: evaluators see every share (no items) with tiles; an evaluator records a share on behalf with the consent reference', async () => {
    await renderPage(<PrearrivalQueuePage />, { persona: 'training-mgr', path: '/training/equivalency/prearrival' });
    const q = await screen.findByTestId('m09-pa-queue', {}, W);
    expect(within(q).getAllByTestId('m09-pa-open').length).toBe(7);
    fireEvent.click(screen.getByTestId('m09-pa-behalf'));
    fireEvent.change(await screen.findByLabelText(/^Contractor/, {}, W), { target: { value: 'c-alnoor-02' } });
    const items = await screen.findByTestId('m09-pa-items', {}, W);
    fireEvent.click(within(items).getAllByRole('checkbox')[0]);
    fireEvent.change(screen.getByLabelText(/^Label/), { target: { value: 'Mechanical fitter call-out' } });
    expect((screen.getByTestId('m09-pa-behalf-submit') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/^Consent form reference/), { target: { value: 'ALN-CF-2026-099' } });
    for (const c of within(screen.getByTestId('m09-pa-consents')).getAllByRole('checkbox')) fireEvent.click(c);
    fireEvent.click(screen.getByTestId('m09-pa-behalf-submit'));
    await confirm();
    await waitFor(() => expect(getLocalBackend().raw('prearrival_shares' as never).some((r: { consent_ref: string }) => r.consent_ref === 'ALN-CF-2026-099')).toBe(true), W);
  });

  it('FS69 share page: the evaluator sees the shared items only and runs the pre-check from them; nothing is written as evidence', async () => {
    await renderPage(<PrearrivalSharePage />, { persona: 'k-instructor', path: '/training/equivalency/prearrival/pa-calnoor01-mech', route: '/training/equivalency/prearrival/:shareId' });
    const shared = await screen.findByTestId('m09-pa-shared', {}, W);
    const refs = within(shared).getAllByTestId('m09-pa-shared-item').map((x) => x.getAttribute('data-ref'));
    expect(refs.length).toBe(5);
    expect(refs).not.toContain('skill:sk-mp-02');
    const before = getLocalBackend().raw('skill_evidence').length;
    fireEvent.click(screen.getByTestId('m09-pa-run'));
    const res = await screen.findByTestId('m09-pa-result', {}, W);
    expect(within(res).getAllByTestId('m09-pa-task').length).toBeGreaterThan(2);
    fireEvent.click(within(res).getAllByTestId('m09-pa-why')[0]);
    expect(await screen.findByTestId('m09-pa-why-panel', {}, W)).toBeTruthy();
    expect(getLocalBackend().raw('skill_evidence').length).toBe(before);
    expect(res.textContent).toMatch(/Writes no skill evidence/);
  });

  it('FS69 share page: an expired link shows nothing personal and an auditor cannot run the check', async () => {
    await renderPage(<PrearrivalSharePage />, { persona: 'k-auditor', path: '/training/equivalency/prearrival/pa-cdhafra06-rp', route: '/training/equivalency/prearrival/:shareId' });
    expect(await screen.findByTestId('m09-pa-closed', {}, W)).toBeTruthy();
    expect(screen.queryByTestId('m09-pa-shared')).toBeNull();
    expect(screen.queryByTestId('m09-pa-run')).toBeNull();
  });

  it('renders in Arabic (readiness and pre-arrival)', async () => {
    await renderPage(<FutureReadinessPage />, { persona: 'alnoor-gm', path: '/ar/partner/workforce/future-readiness' });
    await screen.findByTestId('m09-fr-org', {}, W);
    expect(document.body.textContent).toMatch(/الجاهزية لمهارات المستقبل/);
    expect(document.body.textContent).toMatch(/محو أمية الذكاء الاصطناعي/);
  });
  it('renders the pre-arrival queue in Arabic', async () => {
    await renderPage(<PrearrivalQueuePage />, { persona: 'k-instructor', path: '/ar/training/equivalency/prearrival' });
    await screen.findByTestId('m09-pa-queue', {}, W);
    expect(document.body.textContent).toMatch(/فحوص ما قبل الوصول/);
    expect(document.body.textContent).toMatch(/إرشاد فقط/);
  });
});
