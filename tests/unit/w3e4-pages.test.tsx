// @vitest-environment jsdom
/** F23 pages rendered with the real providers and the in-memory LocalBackend: the reserve hub (expert finder opt-ins only, labelled
 *  synthetic stories, EN and AR), my membership (join with consent and a frozen-skills preview, the ranked board with "Why this?",
 *  interest, withdrawal), the restricted-role notice, the manager request form and list, and the HR desk (approve, shortlist,
 *  suppressed stats, erasure schedule). */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import ReservePage from '../../src/modules/m20/ReservePage';
import ReserveMePage from '../../src/modules/m20/ReserveMePage';
import ReserveRequestPage from '../../src/modules/m20/ReserveRequestPage';
import ReserveDeskPage from '../../src/modules/m20/ReserveDeskPage';
import seed from '../../src/seed/seed.json';

const T = (seed as unknown as { tables: Record<string, any[]> }).tables;
const W = { timeout: 8000 };
const confirm = async () => fireEvent.click(await screen.findByTestId('confirm-action', {}, W));

describe('F23 pages', { timeout: 90000 }, () => { // FS wave C QA: seed boot about 27 s
  it('the hub shows only experts who opted into the finder, with no contact details, and consented synthetic stories', async () => {
    await renderPage(<ReservePage />, { persona: 'k-ro', path: '/opportunities/reserve' });
    const list = await screen.findByTestId('m20-res-experts', {}, W);
    const cards = within(list).getAllByTestId('m20-res-expert');
    expect(cards.length).toBe(T.alumni.filter((m) => m.finder_visible).length);
    expect(list.textContent).not.toMatch(/@|\+971/);
    expect(list.textContent).not.toContain('Yousef Al Marri');
    const stories = screen.getByTestId('m20-res-stories');
    expect(within(stories).getAllByText('Synthetic story').length).toBe(T.alumni_stories.filter((s) => s.listed).length);
    fireEvent.change(screen.getByTestId('m20-res-expert-search'), { target: { value: 'licensing' } });
    await waitFor(() => expect(within(screen.getByTestId('m20-res-experts')).getAllByTestId('m20-res-expert').length).toBeLessThan(cards.length));
    expect(screen.getByTestId('m20-res-how')).toBeTruthy();
  });
  it('renders in Arabic', async () => {
    await renderPage(<ReservePage />, { persona: 'k-ro', path: '/ar/opportunities/reserve' });
    const stories = await screen.findByTestId('m20-res-stories', {}, W);
    expect(stories.textContent).toMatch(/[؀-ۿ]/);
    expect(stories.textContent).toContain('قصة افتراضية');
  });
  it('a member sees HR-approved requests ranked with "Why this?", sends interest and can withdraw consent', async () => {
    await renderPage(<ReserveMePage />, { persona: 'sme-reviewer', path: '/opportunities/reserve/me' });
    const board = await screen.findByTestId('m20-res-board', {}, W);
    const cards = within(board).getAllByTestId('m20-res-board-card');
    expect(cards.length).toBe(T.reserve_requests.filter((r) => r.status === 'open').length);
    expect(within(board).getAllByTestId('m20-res-why').length).toBe(cards.length);
    fireEvent.click(within(board).getAllByTestId('m20-res-why')[0]);
    expect((await screen.findAllByTestId('m20-res-why-panel'))[0].textContent).toMatch(/skills match|Prefers|Availability/);
    expect(board.textContent).not.toMatch(/role card/);
    const before = within(board).getAllByTestId('m20-res-interest').length;
    fireEvent.click(within(board).getAllByTestId('m20-res-interest')[0]);
    fireEvent.click(await screen.findByTestId('m20-res-interest-send', {}, W));
    await waitFor(() => expect(within(screen.getByTestId('m20-res-board')).queryAllByTestId('m20-res-interest').length).toBe(before - 1), W);
    fireEvent.click(screen.getByRole('tab', { name: /Membership and consent/ }));
    fireEvent.click(await screen.findByTestId('m20-res-withdraw', {}, W));
    await confirm();
    expect(await screen.findByTestId('m20-res-withdrawn', {}, { timeout: 15000 })).toBeTruthy();
  });
  it('a staff member joins with consent: preview of the frozen skills, then the board', async () => {
    await renderPage(<ReserveMePage />, { persona: 'nse', path: '/opportunities/reserve/me' });
    const form = await screen.findByTestId('m20-res-join-form', {}, W);
    expect(within(form).getByTestId('m20-res-preview').querySelectorAll('li').length).toBeGreaterThan(0);
    const join = within(form).getByTestId('m20-res-join') as HTMLButtonElement;
    expect(join.disabled).toBe(true);
    fireEvent.click(within(form).getByLabelText(/I consent to joining the reserve/));
    fireEvent.click(join);
    await confirm();
    expect(await screen.findByTestId('m20-res-board', {}, { timeout: 15000 })).toBeTruthy();
  });
  it('security, cyber and safeguards roles see the career-path-only notice instead of the form', async () => {
    await renderPage(<ReserveMePage />, { persona: 'sec-compliance', path: '/opportunities/reserve/me' });
    expect(await screen.findByText(/career path only/, {}, W)).toBeTruthy();
    expect(screen.queryByTestId('m20-res-join-form')).toBeNull();
  });
  it('a manager sends a request to HR and sees it awaiting approval', async () => {
    const { container } = await renderPage(<ReserveRequestPage />, { persona: 'outage-manager', path: '/opportunities/reserve/request' });
    const mine = await screen.findByTestId('m20-res-my-requests', {}, W);
    const n0 = within(mine).getAllByTestId('m20-res-my-request').length;
    fireEvent.click(screen.getByTestId('m20-res-request-send'));
    expect(await screen.findByTestId('m20-res-request-problem', {}, W)).toBeTruthy();
    const set = (name: string, value: string) => fireEvent.change(container.querySelector(`[name="${name}"]`)!, { target: { value } });
    set('title_en', 'Mentor for the new chemistry technicians');
    set('title_ar', 'مرشد لفنيي الكيمياء الجدد');
    set('summary_en', 'Monthly mentoring on sampling and laboratory quality for two new technicians.');
    set('summary_ar', 'إرشاد شهري حول أخذ العينات وجودة المختبر لفنيين جديدين.');
    const pick = within(screen.getByTestId('m20-res-pick'));
    fireEvent.click(pick.getAllByRole('checkbox')[0]);
    await waitFor(() => expect(screen.queryByTestId('m20-res-request-problem')).toBeNull());
    fireEvent.click(screen.getByTestId('m20-res-request-send'));
    await confirm();
    await waitFor(() => expect(within(screen.getByTestId('m20-res-my-requests')).getAllByTestId('m20-res-my-request').length).toBe(n0 + 1), { timeout: 15000 });
    expect(screen.getAllByText(/Waiting for HR approval/).length).toBeGreaterThan(0);
  });
  it('the HR desk approves a pending request, shortlists members with reasons and suppresses small cells', async () => {
    await renderPage(<ReserveDeskPage />, { persona: 'chco', path: '/opportunities/reserve/hr' });
    const pending = await screen.findByTestId('m20-res-pending', {}, W);
    const n0 = within(pending).getAllByTestId('m20-res-pending-card').length;
    expect(n0).toBe(T.reserve_requests.filter((r) => r.status === 'pending_hr').length);
    fireEvent.click(within(pending).getAllByTestId('m20-res-approve-req')[0]);
    await confirm();
    await waitFor(() => expect(screen.queryAllByTestId('m20-res-pending-card').length).toBe(n0 - 1), { timeout: 15000 });
    fireEvent.click(screen.getByRole('tab', { name: /Open requests and shortlists/ }));
    const shortlist = (await screen.findAllByTestId('m20-res-shortlist', {}, W))[0];
    expect(within(shortlist).getAllByTestId('m20-res-candidate').length).toBeGreaterThan(0);
    expect(within(shortlist).getAllByTestId('m20-res-why').length).toBe(within(shortlist).getAllByTestId('m20-res-candidate').length);
    fireEvent.click(screen.getByRole('tab', { name: /Reserve at a glance/ }));
    expect((await screen.findAllByTestId('m20-res-suppressed', {}, W)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: /Registry/ }));
    const er = await screen.findByTestId('m20-res-erasures', {}, W);
    expect(er.textContent).toContain('alm-ops-04');
    expect(er.textContent).not.toContain('Yousef');
  });
  it('the HR desk is empty for non-HR callers (the RPC returns nothing)', async () => {
    await renderPage(<ReserveDeskPage />, { persona: 'outage-manager', path: '/opportunities/reserve/hr' });
    expect(await screen.findByText(/The reserve desk is for HR/, {}, W)).toBeTruthy();
  });
});
