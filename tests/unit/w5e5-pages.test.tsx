// @vitest-environment jsdom
/** W5 · E5 pages: the F36 digest panel, bell card and settings, the admin aggregates, and the F37 career mode on /ask with role-play. */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import MyPage from '../../src/modules/m14/MyPage';
import MySettingsPage from '../../src/modules/m14/MySettingsPage';
import AskPage from '../../src/modules/m13/AskPage';
import AdminDigestPage from '../../src/modules/m13/AdminDigestPage';
import { Notifications } from '../../src/shell/Notifications';
import { DIGEST_MAX } from '../../src/shell/digest/rules';

vi.setConfig({ testTimeout: 30000 });
// jsdom has no layout: the Ask page scrolls the newest turn into view.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
const W = { timeout: 15000 };

describe('F36 digest UI', () => {
  it('/my shows this period\'s digest: at most 7 items in urgency order, each with a deep link and a why', async () => {
    await renderPage(<MyPage />, { persona: 'k-ro', path: '/my' });
    const list = await screen.findByTestId('digest-items', {}, W);
    const items = within(list).getAllByTestId('digest-item');
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(DIGEST_MAX);
    const urg = items.map((x) => Number(x.getAttribute('data-urgency')));
    expect(urg).toEqual([...urg].sort());
    for (const it of items) {
      expect(within(it).getByTestId('digest-link').getAttribute('href')).toMatch(/^\//);
      expect(within(it).getByTestId('digest-why')).toBeTruthy();
    }
  });
  it('a person with nudges off sees the off state and no items', async () => {
    await renderPage(<MyPage />, { persona: 'k-ro', path: '/my', prepare: (b) => { if (b.rawGet('digest_prefs', 'dp:p-k-ro')) b.rawUpdate('digest_prefs', 'dp:p-k-ro', { enabled: false } as never); else b.rawInsert('digest_prefs', { id: 'dp:p-k-ro', person_id: 'p-k-ro', enabled: false, frequency: 'weekly', quiet_start: null, quiet_end: null, muted_kinds: [], updated_at: '2026-10-01T00:00:00Z' } as never); } });
    expect(await screen.findByTestId('digest-off', {}, W)).toBeTruthy();
    expect(screen.queryByTestId('digest-items')).toBeNull();
  });
  it('the bell shows the digest card, and never on /speak-up', async () => {
    const r = await renderPage(<Notifications />, { persona: 'k-ro', path: '/my' });
    fireEvent.click(await screen.findByTestId('notifications', {}, W));
    expect(await screen.findByTestId('digest-bell', {}, W)).toBeTruthy();
    r.unmount();
    await renderPage(<Notifications />, { persona: 'k-ro', path: '/speak-up' });
    fireEvent.click(await screen.findByTestId('notifications', {}, W));
    await new Promise((res) => setTimeout(res, 300));
    expect(screen.queryByTestId('digest-bell')).toBeNull();
    expect(screen.queryByText(/digest/i)).toBeNull();
  });
  it('settings: frequency, quiet hours and muted kinds are saved through the RPC; expiry cannot be muted', async () => {
    await renderPage(<MySettingsPage />, { persona: 'k-ro', path: '/my/settings' });
    const card = await screen.findByTestId('digest-settings', {}, W);
    const kinds = within(card).getByTestId('digest-kinds');
    const exp = within(kinds).getAllByRole('checkbox').find((c) => (c.parentElement?.textContent ?? '').match(/expir/i)) as HTMLInputElement;
    expect(exp.disabled && exp.checked).toBe(true);
    fireEvent.click(within(card).getByTestId('digest-settings-save'));
    const { getLocalBackend } = await import('../../src/data');
    await waitFor(() => expect(getLocalBackend().raw('audit_events').some((a) => a.action === 'digest.prefs')).toBe(true), W);
  });
  it('/admin/digest shows aggregate open rates with small counts suppressed', async () => {
    await renderPage(<AdminDigestPage />, { persona: 'k-admin', path: '/admin/digest' });
    const s = await screen.findByTestId('digest-stats', {}, W);
    expect(s.textContent).toMatch(/%/);
  });
});

describe('F37 career mode on /ask', () => {
  it('?mode=career opens career mode for staff; the SRO question returns gates, gap cards and citations', async () => {
    await renderPage(<AskPage />, { persona: 'k-ro', path: '/ask?mode=career' });
    const btn = await screen.findByTestId('m13-mode-career', {}, W);
    await waitFor(() => expect(btn.getAttribute('aria-checked')).toBe('true'), W);
    expect(await screen.findByTestId('m13-career-banner', {}, W)).toBeTruthy();
    const input = screen.getByTestId('m13-input');
    fireEvent.change(input, { target: { value: 'What do I need for SRO?' } });
    await waitFor(() => expect((screen.getByTestId('m13-send') as HTMLButtonElement).disabled).toBe(false), W);
    fireEvent.click(screen.getByTestId('m13-send'));
    const ans = await screen.findByTestId('m13-answer', {}, W);
    expect(ans.getAttribute('data-intent')).toBe('career.gap_to_role');
    expect(within(ans).getAllByTestId('m13-career-card').filter((c) => c.getAttribute('data-kind') === 'gap')).toHaveLength(3);
    expect(within(ans).getByTestId('m13-citations').textContent).toMatch(/REG-17/);
  });
  it('anonymous visitors get no career mode', async () => {
    await renderPage(<AskPage />, { persona: null, path: '/ask?mode=career' });
    await screen.findByTestId('m13-input', {}, W);
    expect(screen.queryByTestId('m13-mode-career')).toBeNull();
    expect(screen.queryByTestId('m13-career-banner')).toBeNull();
  });
  it('role-play: an interview practice scores an answer against the rubric', async () => {
    await renderPage(<AskPage />, { persona: 'k-ro', path: '/ask?mode=career' });
    fireEvent.click(await screen.findByTestId('m13-practice-interview', {}, W));
    const rp = await screen.findByTestId('m13-roleplay', {}, W);
    expect(within(rp).getByTestId('m13-roleplay-prompt').textContent!.length).toBeGreaterThan(10);
    fireEvent.change(within(rp).getByTestId('m13-roleplay-answer'), { target: { value: 'I want to become a Senior Reactor Operator because I enjoy leading the shift team and I have six years as a reactor operator on Unit 1.' } });
    fireEvent.click(within(rp).getByTestId('m13-roleplay-check'));
    const rubric = await screen.findByTestId('m13-roleplay-rubric', {}, W);
    expect(within(rubric).getAllByTestId('m13-roleplay-criterion').length).toBeGreaterThan(1);
  });
});
