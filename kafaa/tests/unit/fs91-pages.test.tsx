// @vitest-environment jsdom
/** FS78/FS79 pages rendered with the real providers and the in-memory LocalBackend: my learning balance (tiles, why, the gated catalogue,
 *  asking for study time end to end), the line manager's queue (approve through the confirm dialog), the HR page (rule, suppressed
 *  breakdown, HR decisions; read-only for HR analysts), my external certificates (tier legend, trust tiers, crosswalk states, adding one),
 *  the verifier queue (verify through the dialog; never your own), the public tab and Arabic. Every page shows its benchmark chips. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import MyLearningBalancePage from '../../src/modules/m34/MyLearningBalancePage';
import TeamStudyTimePage from '../../src/modules/m34/TeamStudyTimePage';
import LearningBalancesHrPage from '../../src/modules/m34/LearningBalancesHrPage';
import MyExternalCertsPage from '../../src/modules/m34/MyExternalCertsPage';
import ExternalCertsQueuePage from '../../src/modules/m34/ExternalCertsQueuePage';
import RecognitionPage from '../../src/modules/m34/RecognitionPage';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const W = { timeout: 30000 };
const chips = async (ids: string[]) => { for (const id of ids) await waitFor(() => expect(screen.getAllByTestId(`benchmark-chip-${id}`).length).toBeGreaterThan(0), W); };
const confirm = async () => fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
const Y = new Date().toISOString().slice(0, 4);
const raw = (t: string) => getLocalBackend().raw(t as never) as unknown as Row[];

describe('FS78 pages', () => {
  it('my learning balance (k-ro): tiles with the top-up, why, the gated catalogue with criteria, my requests, the FS30 link, ENTITLE and the simulated notice', async () => {
    await renderPage(<MyLearningBalancePage />, { persona: 'k-ro', path: '/my/learning-balance' });
    const tiles = await screen.findByTestId('m34-sb-tiles', {}, { timeout: 90000 });
    expect(tiles.textContent).toMatch(/10\.0 credits/);
    expect(tiles.textContent).toMatch(/40-hour top-up/);
    fireEvent.click(screen.getByTestId('m34-sb-why-grant'));
    expect(screen.getByTestId('m34-sb-why-grant-panel').textContent).toMatch(/years of service/);
    expect(screen.getByTestId('m34-sb-why-grant-panel').textContent).toMatch(/age, gender and nationality are never used/);
    expect(screen.getByTestId('m34-sb-catalogue').children.length).toBeGreaterThan(8);
    expect(screen.getByTestId('m34-sb-criteria').querySelectorAll('li').length).toBeGreaterThanOrEqual(3);
    await waitFor(() => expect(screen.getByTestId('m34-sb-requests').querySelectorAll('tbody tr').length).toBe(2), W);
    expect(screen.getByTestId('m34-sb-earned').textContent).toMatch(/credits/);
    expect(screen.getByTestId('m34-fs91-sim').textContent).toMatch(/simulated/i);
    await chips(['ENTITLE']);
  }, 150000);

  it('asking for study time end to end: the live check, the confirm dialog, the request reserved and sent to the line manager', async () => {
    await renderPage(<MyLearningBalancePage />, { persona: 'k-ro', path: '/my/learning-balance' });
    fireEvent.click(await screen.findByTestId('m34-sb-ask-xr-openlearn-systems', {}, { timeout: 90000 }));
    const dr = await screen.findByTestId('m34-sb-ask-drawer', {}, W);
    expect(within(dr).getByTestId('m34-sb-check').textContent).toMatch(/start date/);
    fireEvent.change(within(dr).getByLabelText(/^Hours/), { target: { value: '12' } });
    fireEvent.change(within(dr).getByLabelText('Starts'), { target: { value: `${Y}-12-01` } });
    fireEvent.change(within(dr).getByLabelText('Ends'), { target: { value: `${Y}-12-17` } });
    fireEvent.change(within(dr).getByLabelText('What the study time is for'), { target: { value: 'Systems thinking for my requalification project' } });
    await waitFor(() => expect((within(dr).getByTestId('m34-sb-send') as HTMLButtonElement).disabled).toBe(false), W);
    fireEvent.click(within(dr).getByTestId('m34-sb-send'));
    await confirm();
    await waitFor(() => expect(raw('study_time_requests').some((r) => r.person_id === 'p-k-ro' && r.resource_id === 'xr-openlearn-systems' && r.status === 'requested' && r.hours === 12 && r.line_manager_id === 'p-sro')).toBe(true), W);
    expect(raw('learning_balances').find((r) => r.id === `lb:p-k-ro:${Y}`)!.pending_hours).toBe(32);
  }, 150000);

  it('the line manager (sro) approves k-ro\'s waiting request through the confirm dialog; the team balances show', async () => {
    await renderPage(<TeamStudyTimePage />, { persona: 'sro', path: '/team/study-time' });
    const id = raw('study_time_requests').find((r) => r.person_id === 'p-k-ro' && r.status === 'requested')!.id;
    fireEvent.click(await screen.findByTestId(`m34-sb-approve-${id}`, {}, { timeout: 90000 }));
    await confirm();
    await waitFor(() => expect(raw('study_time_requests').find((r) => r.id === id)!.status).toBe('approved'), W);
    expect(raw('study_time_requests').find((r) => r.id === id)!.decided_by).toBe('p-sro');
    expect(screen.getByTestId('m34-sb-team-balances').querySelectorAll('tbody tr').length).toBeGreaterThan(0);
    await chips(['ENTITLE']);
  }, 150000);

  it('HR (chco): the published rule, a suppressed breakdown, and HR decisions on waiting requests', async () => {
    await renderPage(<LearningBalancesHrPage />, { persona: 'chco', path: '/workforce/learning-balances' });
    expect((await screen.findByTestId('m34-sb-hr-tiles', {}, { timeout: 90000 })).textContent).toMatch(/106/);
    expect(screen.getByTestId('m34-sb-rule').textContent).toMatch(/never inputs/);
    expect(screen.getByTestId('m34-sb-stats').textContent).toMatch(/Suppressed/);
    const op = raw('study_time_requests').find((r) => r.person_id === 'p-outage-planner' && r.status === 'requested')!;
    fireEvent.click(await screen.findByTestId(`m34-sb-hr-approve-${op.id}`, {}, W));
    await confirm();
    await waitFor(() => expect(raw('study_time_requests').find((r) => r.id === op.id)!.decided_role).toBe('hr_director'), W);
  }, 150000);

  it('HR analysts read the HR page without decision buttons', async () => {
    await renderPage(<LearningBalancesHrPage />, { persona: 'k-hr-analyst', path: '/workforce/learning-balances' });
    expect(await screen.findByTestId('m34-sb-hr-queue', {}, { timeout: 90000 })).toBeTruthy();
    expect(screen.queryAllByTestId(/^m34-sb-hr-approve-/).length).toBe(0);
    expect(document.body.textContent).toMatch(/Read only/);
  }, 150000);

  it('renders in Arabic (RTL wording, Arabic digits through useFormat)', async () => {
    await renderPage(<MyLearningBalancePage />, { persona: 'k-ro', path: '/ar/my/learning-balance' });
    expect(await screen.findByTestId('m34-sb-tiles', {}, { timeout: 90000 })).toBeTruthy();
    expect(document.body.textContent).toContain('الكتالوج المشروط بالنتائج');
    expect(document.body.textContent).toContain('رصيد محاكى');
  }, 150000);
});

describe('FS79 pages', () => {
  it('my external certificates (k-ro): the tier legend, both certificates with their trust tier, crosswalk states and CORP / SKILLS-TECH / 1EDTECH', async () => {
    await renderPage(<MyExternalCertsPage />, { persona: 'k-ro', path: '/my/recognition/certificates' });
    expect(await screen.findByTestId('m34-tier-legend', {}, { timeout: 90000 })).toBeTruthy();
    const v = await screen.findByTestId('m34-xc-cert-xc-p-k-ro-01', {}, W);
    expect(within(v).getByTestId('m34-tier').getAttribute('data-tier')).toBe('vendor_self_serve');
    expect(within(v).getByTestId('m34-xc-mapping').querySelectorAll('[data-state="maps"]').length).toBe(1);
    expect(within(v).getByTestId('m34-xc-mapping').querySelectorAll('[data-state="unreviewed"]').length).toBe(1);
    const s = screen.getByTestId('m34-xc-cert-xc-p-k-ro-02');
    expect(within(s).getByTestId('m34-tier').getAttribute('data-tier')).toBe('claimed');
    expect(s.textContent).toMatch(/would map at level 2 once verified/);
    expect(screen.getByTestId('m34-not-authority')).toBeTruthy();
    await chips(['CORP', 'SKILLS-TECH', '1EDTECH']);
  }, 150000);

  it('adding a certificate: the live check, the mapping preview (reviewed rows only), the confirm dialog, "claimed"', async () => {
    await renderPage(<MyExternalCertsPage />, { persona: 'k-ro', path: '/my/recognition/certificates' });
    fireEvent.click(await screen.findByTestId('m34-xc-add', {}, { timeout: 90000 }));
    const dr = await screen.findByTestId('m34-xc-add-drawer', {}, W);
    fireEvent.change(within(dr).getByLabelText('Certificate title'), { target: { value: 'Certificate in creative practice' } });
    fireEvent.change(within(dr).getByLabelText('Issuer'), { target: { value: 'Sample professional body (synthetic)' } });
    fireEvent.change(within(dr).getByLabelText('Kind of issuer'), { target: { value: 'professional_body' } });
    fireEvent.change(within(dr).getByLabelText('Accreditation reference'), { target: { value: 'ACC-SAMPLE-9' } });
    fireEvent.change(within(dr).getByLabelText('Certificate number'), { target: { value: 'PAGE-SAMPLE-1' } });
    fireEvent.change(within(dr).getByLabelText('Issued'), { target: { value: '2026-05-01' } });
    fireEvent.change(within(dr).getByLabelText('Verification link (https)'), { target: { value: 'https://certificates.example.org/verify/page-sample-1' } });
    fireEvent.change(within(dr).getByLabelText(/Crosswalk entries it covers/), { target: { value: 'think creatively' } });
    fireEvent.click(await within(dr).findByTestId('m34-xc-pick-al:sk-fs-tr-creative:esco:c624c6a3', {}, W));
    await waitFor(() => expect((within(dr).getByTestId('m34-xc-send') as HTMLButtonElement).disabled).toBe(false), W);
    expect(within(dr).getByTestId('m34-xc-mapping').querySelectorAll('[data-state="maps"]').length).toBe(1);
    fireEvent.click(within(dr).getByTestId('m34-xc-send'));
    await confirm();
    await waitFor(() => expect(raw('external_certs').some((c) => c.person_id === 'p-k-ro' && c.credential_ref === 'PAGE-SAMPLE-1' && c.status === 'submitted' && c.tier === null)).toBe(true), W);
    expect(raw('skill_evidence').filter((e) => e.ref_table === 'external_certs' && e.person_id === 'p-k-ro' && e.active).length).toBe(1);
  }, 150000);

  it('the verifier queue (training manager) verifies k-ro\'s waiting certificate through the dialog; evidence is written', async () => {
    await renderPage(<ExternalCertsQueuePage />, { persona: 'training-mgr', path: '/recognition/certificates' });
    expect(await screen.findByTestId('m34-xc-q-tiles', {}, { timeout: 90000 })).toBeTruthy();
    fireEvent.click(await screen.findByTestId('m34-xc-open-xc-p-k-ro-02', {}, W));
    fireEvent.click(await screen.findByTestId('m34-xc-verify', {}, W));
    await confirm();
    await waitFor(() => expect(raw('external_certs').find((c) => c.id === 'xc-p-k-ro-02')!.status).toBe('verified'), W);
    const ev = raw('skill_evidence').filter((e) => e.ref_id === 'xc-p-k-ro-02');
    expect(ev.map((e) => e.skill_id).sort()).toEqual(['sk-fs-tr-analytical', 'sk-fs-tr-systems']);
    expect(ev.every((e) => e.basis === 'validated' && e.level === 2)).toBe(true);
    await chips(['CORP']);
  }, 150000);

  it('maker-checker on the queue: the HR director opening their own certificate sees the refusal and no verify button', async () => {
    await renderPage(<ExternalCertsQueuePage />, { persona: 'chco', path: '/recognition/certificates' });
    fireEvent.click(await screen.findByTestId('m34-xc-open-xc-p-chco-01', {}, { timeout: 90000 }));
    expect(await screen.findByTestId('m34-xc-mc', {}, W)).toBeTruthy();
    expect(screen.queryByTestId('m34-xc-verify')).toBeNull();
  }, 150000);

  it('the public recognition page explains the balance and the trust tiers (FS78 and FS79 chips)', async () => {
    await renderPage(<RecognitionPage />, { persona: null, path: '/recognition?tab=balance' });
    expect(await screen.findByTestId('m34-pub-balance', {}, { timeout: 90000 })).toBeTruthy();
    expect(screen.getByTestId('m34-tier-legend').children.length).toBe(4);
    await chips(['ENTITLE', 'CORP', '1EDTECH']);
  }, 150000);
});
