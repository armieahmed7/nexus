// @vitest-environment jsdom
/** FS75 future-skills nudges in the digest UI (wave H · E3, fsHe3): /my panel (EN and AR), the bell, the nudge settings, the admin
 *  aggregates, and no nudge on speak-up routes. The clock is fixed on the release day (2026-10-12, week 2026-W42, 09:00 Abu Dhabi). */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import MyPage from '../../src/modules/m14/MyPage';
import MySettingsPage from '../../src/modules/m14/MySettingsPage';
import AdminDigestPage from '../../src/modules/m13/AdminDigestPage';
import { Notifications } from '../../src/shell/Notifications';
import { DigestPanel } from '../../src/shell/digest/DigestPanel';
import { DIGEST_MAX } from '../../src/shell/digest/rules';

vi.setConfig({ testTimeout: 90000 });
const W = { timeout: 20000 };
beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-12T05:00:00Z')); });
afterAll(() => { vi.useRealTimers(); });

describe('FS75 digest UI', () => {
  it('AC3: /my builds the week-42 digest with future-skills items, each with a deep link and a "why" (EN), at most 7 items', async () => {
    await renderPage(<MyPage />, { persona: 'k-ro', path: '/my' });
    const list = await screen.findByTestId('digest-items', {}, { timeout: 60000 });
    const items = within(list).getAllByTestId('digest-item');
    expect(items.length).toBeLessThanOrEqual(DIGEST_MAX);
    const fut = items.filter((x) => x.getAttribute('data-kind') === 'future');
    expect(fut.length).toBeGreaterThan(0);
    for (const it of fut) {
      expect(within(it).getByTestId('digest-link').getAttribute('href')).toMatch(/^\/kafaa\/[a-z]|^\/[a-z]/);
      fireEvent.click(within(it).getByTestId('digest-why'));
      const panel = within(it).getByTestId('digest-why-panel');
      expect(panel.textContent!.length).toBeGreaterThan(20);
      expect(panel.textContent).not.toMatch(/digest\.why\./);
    }
    const strip = screen.getByTestId('digest-future');
    expect(within(strip).getByTestId('digest-future-count').textContent).toMatch(/future-skills items/);
    expect(within(strip).getByTestId('benchmark-chips')).toBeTruthy();
    fireEvent.click(within(strip).getByTestId('digest-future-how'));
    expect((await within(strip).findAllByTestId('digest-future-rule', {}, W)).length).toBe(8);
  });
  it('AC3: the same items read in Arabic (titles, lines and reasons), with links under /ar', async () => {
    await renderPage(<MyPage />, { persona: 'k-ro', path: '/ar/my' });
    const list = await screen.findByTestId('digest-items', {}, { timeout: 60000 });
    const fut = within(list).getAllByTestId('digest-item').filter((x) => x.getAttribute('data-kind') === 'future');
    expect(fut.length).toBeGreaterThan(0);
    for (const it of fut) {
      expect(it.textContent).toMatch(/[؀-ۿ]/);
      expect(within(it).getByTestId('digest-link').getAttribute('href')).toMatch(/\/ar\//);
      fireEvent.click(within(it).getByTestId('digest-why'));
      expect(within(it).getByTestId('digest-why-panel').textContent).toMatch(/[؀-ۿ]{4}/);
    }
  });
  it('AC2: no nudge on speak-up routes: the digest panel and the bell card render nothing on /speak-up (EN and AR)', async () => {
    for (const path of ['/speak-up', '/ar/speak-up']) {
      const r = await renderPage(<><DigestPanel /><Notifications /></>, { persona: 'k-ro', path });
      fireEvent.click(await screen.findByTestId('notifications', {}, W));
      await new Promise((res) => setTimeout(res, 300));
      expect(screen.queryByTestId('digest-panel')).toBeNull();
      expect(screen.queryByTestId('digest-bell')).toBeNull();
      expect(screen.queryByTestId('digest-future')).toBeNull();
      r.unmount();
    }
    // control: the same components show the digest elsewhere
    await renderPage(<DigestPanel />, { persona: 'k-ro', path: '/my' });
    expect(await screen.findByTestId('digest-panel', {}, W)).toBeTruthy();
  });
  it('settings: "Future skills" is a mutable kind saved through the RPC, and the published rules are listed', async () => {
    await renderPage(<MySettingsPage />, { persona: 'k-ro', path: '/my/settings' });
    const card = await screen.findByTestId('digest-settings', {}, W);
    const box = within(within(card).getByTestId('digest-kinds')).getAllByRole('checkbox').find((c) => (c.parentElement?.textContent ?? '').match(/^Future skills/)) as HTMLInputElement;
    expect(box && !box.disabled && box.checked).toBe(true);
    fireEvent.click(box);
    fireEvent.click(within(card).getByTestId('digest-settings-save'));
    const { getLocalBackend } = await import('../../src/data');
    await waitFor(() => expect(getLocalBackend().raw('digest_prefs').find((p) => p.person_id === 'p-k-ro')?.muted_kinds).toContain('future'), W);
    fireEvent.click(within(screen.getByTestId('digest-settings-future')).getByText(/How future-skills nudges work/));
    expect((await screen.findAllByTestId('digest-future-rule', {}, W)).length).toBe(8);
  });
  it('/admin/digest lists the future kind (suppressed under 10) and the future-skills rule line', async () => {
    await renderPage(<AdminDigestPage />, { persona: 'k-admin', path: '/admin/digest' });
    const s = await screen.findByTestId('digest-stats', {}, W);
    expect(s.textContent).toMatch(/Future skills/);
    expect(screen.getByTestId('digest-admin-future').textContent).toMatch(/at most 2 per digest/);
  });
});
