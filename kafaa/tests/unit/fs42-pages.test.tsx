// @vitest-environment jsdom
/** FS29/FS30 pages rendered with the real providers and the in-memory LocalBackend: the public explainer (EN and AR) with the evidence
 *  kinds, the NQF map, the stacks and the catalogue; my recognition; one request with its pack, decision, statement and export; the
 *  assessor queue and the maker-checker review; my credits (stacks, ledger, sync status); and the tag admin page. Every page shows the
 *  FS29/FS30 benchmark chips and says Kafa'a is not a licensing or regulatory authority. */
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderPage } from './g1-harness';
import RecognitionPage from '../../src/modules/m34/RecognitionPage';
import MyRecognitionPage from '../../src/modules/m34/MyRecognitionPage';
import RplRequestPage from '../../src/modules/m34/RplRequestPage';
import RplQueuePage from '../../src/modules/m34/RplQueuePage';
import RplReviewPage from '../../src/modules/m34/RplReviewPage';
import MyCreditsPage from '../../src/modules/m34/MyCreditsPage';
import CreditTagsPage from '../../src/modules/m34/CreditTagsPage';

const T = { timeout: 30000 };
const notAuthority = () => expect(screen.getByTestId('m34-not-authority').textContent).toMatch(/not a licensing or regulatory authority|ليست جهة ترخيص أو جهة تنظيمية/);
const chips = async (ids: string[]) => { for (const id of ids) await waitFor(() => expect(screen.getAllByTestId(`benchmark-chip-${id}`).length).toBeGreaterThan(0), T); };

describe('FS29/FS30 pages', () => {
  it('the public explainer: flow, five evidence kinds plus the never-in-a-pack card, outcomes, chips and the notice', async () => {
    await renderPage(<RecognitionPage />, { persona: null, path: '/recognition' });
    expect(await screen.findByTestId('m34-pub-rpl', {}, { timeout: 90000 })).toBeTruthy();
    expect(screen.getByTestId('m34-pub-kinds').querySelectorAll('li').length).toBe(6);
    notAuthority();
    await chips(['ILO-RPL', 'UAE-NQF', 'UK-NUC', 'ENTITLE', 'UPKEEP']);
  }, 150000);
  it('the NQF tab: the indicative note, the four-level map, four stacks and the tagged catalogue', async () => {
    await renderPage(<RecognitionPage />, { persona: null, path: '/recognition?tab=nqf' });
    expect(await screen.findByTestId('m34-pub-nqf', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m34-indicative').textContent).toMatch(/indicative until agreed with the NQC and the partner/i);
    await waitFor(() => expect(screen.getByTestId('m34-pub-map').querySelectorAll('tbody tr').length).toBe(4), T);
    expect(screen.getByTestId('m34-pub-stacks').children.length).toBe(4);
    expect(screen.getByTestId('m34-pub-catalogue').querySelectorAll('tbody tr').length).toBeGreaterThan(5);
  }, 60000);
  it('renders in Arabic with the notice and the indicative wording', async () => {
    await renderPage(<RecognitionPage />, { persona: null, path: '/ar/recognition?tab=nqf' });
    expect(await screen.findByTestId('m34-pub-nqf', {}, T)).toBeTruthy();
    expect(document.body.textContent).toContain('كفاءة ليست جهة ترخيص أو جهة تنظيمية');
    expect(screen.getByTestId('m34-indicative').textContent).toContain('إرشادي إلى حين الاتفاق مع المركز الوطني للمؤهلات والشريك');
  }, 60000);
  it('my recognition (sro): tiles, my requests and the start drawer entry', async () => {
    await renderPage(<MyRecognitionPage />, { persona: 'sro', path: '/my/recognition' });
    expect(await screen.findByTestId('m34-my-tiles', {}, T)).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('m34-my-requests').querySelectorAll('tbody tr').length).toBeGreaterThanOrEqual(2), T);
    expect(screen.getByTestId('m34-start')).toBeTruthy();
    notAuthority();
    await chips(['ILO-RPL']);
  }, 60000);
  it('a decided request (sro): the pack, the decision by two people, the stored statement and the export', async () => {
    await renderPage(<RplRequestPage />, { persona: 'sro', path: '/my/recognition/rpl/rpl-p-sro-01', route: '/my/recognition/rpl/:id' });
    expect(await screen.findByTestId('m34-detail', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m34-pack').querySelectorAll('li').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('m34-decision')).toBeTruthy();
    expect(screen.getByTestId('m34-statement').textContent).toMatch(/credit/i);
    expect(screen.getByTestId('m34-export')).toBeTruthy();
    notAuthority();
  }, 60000);
  it('the assessor queue (training manager): tiles, tabs and the contractor entry', async () => {
    await renderPage(<RplQueuePage />, { persona: 'training-mgr', path: '/recognition/review' });
    expect(await screen.findByTestId('m34-queue-tiles', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m34-queue')).toBeTruthy();
    expect(screen.getByTestId('m34-behalf')).toBeTruthy();
    notAuthority();
  }, 60000);
  it('maker-checker on review: the second assessor can confirm, the recommender cannot', async () => {
    await renderPage(<RplReviewPage />, { persona: 'training-mgr', path: '/recognition/review/rpl-p-k-ro-01', route: '/recognition/review/:id' });
    expect(await screen.findByTestId('m34-review', {}, T)).toBeTruthy();
    await waitFor(() => expect((screen.getByTestId('m34-confirm') as HTMLButtonElement).disabled).toBe(false), T);
  }, 60000);
  it('maker-checker on review: the recommender sees the maker_checker refusal', async () => {
    await renderPage(<RplReviewPage />, { persona: 'sq-lead', path: '/recognition/review/rpl-p-k-ro-01', route: '/recognition/review/:id' });
    expect(await screen.findByTestId('m34-review', {}, T)).toBeTruthy();
    expect(await screen.findByTestId('m34-mc', {}, T)).toBeTruthy();
    notAuthority();
  }, 60000);
  it('my credits (sro): tiles, four stacks with reasons, the ledger and an up-to-date sync status', async () => {
    await renderPage(<MyCreditsPage />, { persona: 'sro', path: '/my/credits' });
    expect(await screen.findByTestId('m34-cr-tiles', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m34-cr-stacks').children.length).toBe(4);
    await waitFor(() => expect(screen.getByTestId('m34-cr-ledger').querySelectorAll('tbody tr').length).toBe(8), T); // 5 + 3 FS31 credentials (MC-AI-ASSURER, MC-SMR-FOUND, MC-TWINS) tagged by the wave-D QA
    await waitFor(() => expect(screen.getByTestId('m34-cr-sync').textContent).toMatch(/Up to date/), T);
    expect(screen.getByTestId('m34-indicative')).toBeTruthy();
    await chips(['ENTITLE', 'UAE-NQF']);
  }, 60000);
  it('the tag admin page (instructor): coverage tiles and every current micro-credential tagged', async () => {
    await renderPage(<CreditTagsPage />, { persona: 'k-instructor', path: '/admin/credit-tags' });
    expect(await screen.findByTestId('m34-tags-tiles', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m34-tags-mc').textContent).toMatch(/Every current micro-credential is tagged/);
    expect(screen.getByTestId('m34-tags-table').querySelectorAll('tbody tr').length).toBeGreaterThan(5);
    notAuthority();
  }, 60000);
});
