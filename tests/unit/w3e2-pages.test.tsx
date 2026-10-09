// @vitest-environment jsdom
/** F20/F21 pages rendered with the real providers and the in-memory LocalBackend: the KLRA register with reasons and the risk
 *  matrix (KM owner), the suppressed department heatmap only for HR, a department head's scope, the position page with its
 *  mitigation plan, the knowledge base search with citations, an asset page, the capture board, an interview workspace with the
 *  live content screen and enrichment, and the review queue; in English and Arabic. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import KlraPage from '../../src/modules/m24/KlraPage';
import KlraPositionPage from '../../src/modules/m24/KlraPositionPage';
import KnowledgePage from '../../src/modules/m24/KnowledgePage';
import AssetPage from '../../src/modules/m24/AssetPage';
import CapturePage from '../../src/modules/m24/CapturePage';
import SessionPage from '../../src/modules/m24/SessionPage';
import ReviewPage from '../../src/modules/m24/ReviewPage';

const T = { timeout: 15000 };

describe('F20 pages', () => {
  it('the KM owner sees the register with reasons, the pending positions and the risk matrix', async () => {
    await renderPage(<KlraPage />, { persona: 'training-mgr', path: '/knowledge/klra' });
    const reg = await screen.findByTestId('m24-klra-register', {}, T);
    expect(within(reg).getAllByTestId('m24-klra-why').length).toBeGreaterThan(5);
    expect(screen.getByTestId('m24-klra-pending').querySelectorAll('li').length).toBe(8);
    expect(screen.getByTestId('m24-klra-reassess')).toBeTruthy();
    fireEvent.click(within(reg).getAllByTestId('m24-klra-why')[0]);
    expect((await screen.findByTestId('m24-klra-why-panel')).textContent).toMatch(/attrition|criticality|codified/i);
    expect((document.body.textContent ?? '').replaceAll('No birth date, age or exact date is held or shown.', '')).not.toMatch(/birth|\bage\b|years old/i);
    fireEvent.click(screen.getByRole('tab', { name: /Risk matrix/ }));
    expect(await screen.findByTestId('m24-risk-matrix')).toBeTruthy();
  }, 30000);
  it('HR sees only the department heatmap, with cells under 10 suppressed', async () => {
    await renderPage(<KlraPage />, { persona: 'chco', path: '/knowledge/klra' });
    const h = await screen.findByTestId('m24-klra-heatmap', {}, T);
    expect(h.textContent).toMatch(/<10/);
    expect(screen.queryByTestId('m24-klra-register')).toBeNull();
    expect(document.body.textContent).toMatch(/Aggregates only/);
  }, 30000);
  it('a department head (crew B) sees the scope note and only crew B positions', async () => {
    await renderPage(<KlraPage />, { persona: 'sro', path: '/knowledge/klra' });
    const reg = await screen.findByTestId('m24-klra-register', {}, T);
    expect(document.body.textContent).toMatch(/positions in your scope/);
    expect(reg.textContent).toMatch(/Crew B/);
    expect(reg.textContent).not.toMatch(/Crew A|Crew C/);
  }, 30000);
  it('the position page shows the drivers, history and the mitigation plan with links', async () => {
    await renderPage(<KlraPositionPage />, { persona: 'training-mgr', path: '/knowledge/klra/pos-w-sro-01', route: '/knowledge/klra/:positionId' });
    await screen.findByTestId('m24-position-head', {}, T);
    expect(document.body.textContent).toMatch(/Retirement window/);
    expect(document.body.textContent).toMatch(/Quarterly history/);
    const acts = screen.getByTestId('m24-position-actions');
    expect(acts.textContent).toMatch(/Knowledge capture/);
    expect(acts.textContent).toMatch(/Plan a capture interview/);
    fireEvent.click(screen.getByTestId('m24-position-why'));
    expect((await screen.findByTestId('m24-position-why-panel')).textContent).toMatch(/successor/);
  }, 30000);
  it('renders the register in Arabic', async () => {
    await renderPage(<KlraPage />, { persona: 'training-mgr', path: '/ar/knowledge/klra' });
    await screen.findByTestId('m24-klra-register', {}, T);
    expect(document.body.textContent).toMatch(/مخاطر فقدان المعرفة|المغادرة/);
  }, 30000);
});

describe('F21 pages', () => {
  it('the knowledge base finds the asset and the related OE lesson, each with a citation', async () => {
    await renderPage(<KnowledgePage />, { persona: 'k-ro', path: '/knowledge' });
    const input = await screen.findByTestId('m24-kb-search', {}, T);
    fireEvent.change(input, { target: { value: 'peer check redundant train' } });
    const res = await screen.findByTestId('m24-kb-results', {}, T);
    expect(within(res).getAllByTestId('m24-kb-hit-asset')[0].textContent).toMatch(/redundant trains/);
    expect(within(res).getAllByTestId('m24-kb-hit-oe').some((x) => /peer check/.test(x.textContent ?? ''))).toBe(true);
    expect(within(res).getAllByTestId('m24-kb-citation').length).toBeGreaterThanOrEqual(2);
    expect(res.textContent).toMatch(/Used by 14 colleagues/);
  }, 30000);
  it('an asset page shows provenance, related OE and the "used by" rule', async () => {
    await renderPage(<AssetPage />, { persona: 'k-ro', path: '/knowledge/assets/kas-003', route: '/knowledge/assets/:assetId' });
    const a = await screen.findByTestId('m24-asset', {}, T);
    expect(a.textContent).toMatch(/Place-keeping/);
    expect(screen.getByTestId('m24-asset-usedby').textContent).toMatch(/fewer than 10/);
    expect(screen.queryByTestId('m24-asset-withdraw')).toBeNull();
  }, 30000);
  it('the capture board shows every state for the KM owner and "who to capture next" from the KLRA', async () => {
    await renderPage(<CapturePage />, { persona: 'training-mgr', path: '/knowledge/capture' });
    const board = await screen.findByTestId('m24-capture-board', {}, T);
    expect(within(board).getAllByTestId('m24-session-card').length).toBe(16);
    expect(await screen.findByTestId('m24-capture-who', {}, T)).toBeTruthy();
  }, 30000);
  it('an interview workspace blocks restricted text before upload', async () => {
    await renderPage(<SessionPage />, { persona: 'head-sq', path: '/knowledge/capture/cs-011', route: '/knowledge/capture/:sessionId' });
    const ta = await screen.findByTestId('m24-session-transcript', {}, T);
    fireEvent.change(ta, { target: { value: 'The CCTV camera coverage along the perimeter is the first thing I explain to newcomers. '.repeat(4) } });
    expect(document.body.textContent).toMatch(/Security content found/);
    expect((screen.getByTestId('m24-session-upload') as HTMLButtonElement).disabled).toBe(true);
  }, 30000);
  it('a transcribed interview shows the asset editor with enrichment suggestions', async () => {
    await renderPage(<SessionPage />, { persona: 'k-instructor', path: '/knowledge/capture/cs-002', route: '/knowledge/capture/:sessionId' });
    await screen.findByTestId('m24-session-text', {}, T);
    expect(document.body.textContent).toMatch(/Published|In review|Knowledge asset from this interview/);
  }, 30000);
  it('the review queue shows the two-person state and the publish gate', async () => {
    await renderPage(<ReviewPage />, { persona: 'training-mgr', path: '/knowledge/review' });
    const q = await screen.findByTestId('m24-review-queue', {}, T);
    expect(q.querySelectorAll('li').length).toBe(2);
    expect(screen.getByTestId('m24-review-state').textContent).toMatch(/passed by|not done yet/);
    expect(screen.getByTestId('m24-review-publish')).toBeTruthy();
  }, 30000);
  it('the knowledge base renders in Arabic', async () => {
    await renderPage(<KnowledgePage />, { persona: 'k-ro', path: '/ar/knowledge' });
    await screen.findByTestId('m24-kb-latest', {}, T);
    expect(document.body.textContent).toMatch(/العمل على المسارات الاحتياطية/);
  }, 30000);
});
