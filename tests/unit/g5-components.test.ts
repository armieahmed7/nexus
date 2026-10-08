// @vitest-environment jsdom
/**
 * G5 component tests (testing-library, jsdom). Written with createElement so the shared vitest config (.test.ts only)
 * needs no change. Covers: the speak-up page makes no writes; the gated confirm stays disabled until its checks pass;
 * the admin console shows locked flags as unchangeable and hides the flag switches from non-admins.
 */
import { createElement as h, type ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../src/i18n';
import { ToastProvider } from '../../src/ui/Toast';
import { SessionProvider } from '../../src/auth/session';
import { getLocalBackend } from '../../src/data';
import { config } from '../../src/config';
import SpeakUpPage from '../../src/modules/m08/SpeakUpPage';
import AdminPage from '../../src/modules/m16/AdminPage';
import { GatedConfirm } from '../../src/modules/m16/parts';

function wrap(node: ReactNode, path = '/') {
  return h(MemoryRouter, { initialEntries: [path] }, h(I18nProvider, null, h(ToastProvider, null, h(SessionProvider, null, node))));
}
function signIn(persona: string | null) {
  if (persona) localStorage.setItem(config.sessionKey, JSON.stringify({ persona, at: Date.now() }));
  else localStorage.removeItem(config.sessionKey);
}

beforeAll(async () => {
  const b = getLocalBackend();
  await b.whenReady();
  await b.reset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('speak-up (M08)', () => {
  it('renders the ECP channels and makes no writes, RPCs or local records', async () => {
    signIn(null);
    const b = getLocalBackend();
    const ins = vi.spyOn(b, 'insert');
    const upd = vi.spyOn(b, 'update');
    const denied = vi.spyOn(b.rpc, 'logDenied');
    render(wrap(h(SpeakUpPage), '/speak-up'));
    await waitFor(() => expect(screen.getByTestId('m08-ecp-channels')).toBeTruthy());
    expect(screen.getByTestId('m08-speak-anonymous')).toBeTruthy();
    expect(ins).not.toHaveBeenCalled();
    expect(upd).not.toHaveBeenCalled();
    expect(denied).not.toHaveBeenCalled();
    expect(localStorage.getItem(config.localStorageKey) ?? '').not.toContain('speak-up');
  });
});

describe('GatedConfirm (M16 parts)', () => {
  it('keeps the confirm button disabled until ready, then runs the action once', async () => {
    const onConfirm = vi.fn();
    const { rerender } = render(wrap(h(GatedConfirm, { open: true, onClose: () => undefined, title: 'Publish', consequence: 'Goes live', ready: false, onConfirm })));
    const btn = () => screen.getByTestId('confirm-action') as HTMLButtonElement;
    expect(btn().disabled).toBe(true);
    rerender(wrap(h(GatedConfirm, { open: true, onClose: () => undefined, title: 'Publish', consequence: 'Goes live', ready: true, onConfirm })));
    expect(btn().disabled).toBe(false);
    fireEvent.click(btn());
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });
});

describe('admin console (M16)', () => {
  it('platform admin: locked flags are disabled, ordinary flags can be switched', async () => {
    signIn('k-admin');
    render(wrap(h(AdminPage), '/admin'));
    const locked = (await screen.findByTestId('m16-flag-speak_up_no_telemetry')) as HTMLButtonElement;
    expect(locked.disabled).toBe(true);
    const news = screen.getByTestId('m16-flag-news') as HTMLButtonElement;
    expect(news.disabled).toBe(false);
    expect(screen.getByTestId('m16-reset')).toBeTruthy();
  });
  it('content editor: no flag switches, no demo reset', async () => {
    signIn('k-editor');
    render(wrap(h(AdminPage), '/admin'));
    await screen.findByTestId('m16-areas');
    expect(screen.queryByTestId('m16-flags')).toBeNull();
    expect(screen.queryByTestId('m16-reset')).toBeNull();
  });
});
