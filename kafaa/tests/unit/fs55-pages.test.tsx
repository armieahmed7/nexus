// @vitest-environment jsdom
/** FS49 pages rendered with the real providers and the in-memory LocalBackend: the AI safety-culture page (traits with AI examples,
 *  AI-era HU cards with drill links, the situation matcher with reasons, sourced lessons, FS49 chips) in EN and AR; the lead console
 *  (content health, editor check); the extended learning page, the public safety-culture page and the OE lesson drawer; and /speak-up
 *  rendered with spies on fetch, every RPC and every write (the speak-up network check stays green). */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import AiSafetyCulturePage from '../../src/modules/m08/AiSafetyCulturePage';
import HuToolsAdminPage from '../../src/modules/m08/HuToolsAdminPage';
import MySafetyCulturePage from '../../src/modules/m08/MySafetyCulturePage';
import SafetyCulturePage from '../../src/modules/m08/SafetyCulturePage';
import OePage from '../../src/modules/m08/OePage';
import SpeakUpPage from '../../src/modules/m08/SpeakUpPage';

const W = { timeout: 30000 };

describe('FS49 pages', () => {
  it('staff see both traits with AI examples, the four AI-era cards each linked to a drill, sourced lessons and the FS49 chips', async () => {
    await renderPage(<AiSafetyCulturePage />, { persona: 'qc-inspector', path: '/my/safety-culture/ai' });
    const cards = await screen.findByTestId('m08-ai-cards', {}, { timeout: 90000 });
    const ai = within(cards).getAllByTestId('m08-hu-card');
    expect(ai.map((c) => c.getAttribute('data-id'))).toEqual(['hu-ai-bias', 'hu-ai-mode', 'hu-ai-reliance', 'hu-ai-verify']);
    for (const c of ai) expect(within(c).getAllByTestId('m08-hu-drill').length).toBeGreaterThanOrEqual(1);
    // qc-inspector passed the valve line-up drill (FS37 seed): the link says so
    const valve = () => within(screen.getByTestId('m08-ai-cards')).getAllByTestId('m08-hu-drill').find((x) => x.getAttribute('data-id') === 'ad-valve-lineup')!;
    expect(valve().getAttribute('href')).toContain('/my/ai-fluency/drills/ad-valve-lineup');
    await waitFor(() => expect(valve().textContent).toMatch(/Passed/), W);
    expect(within(screen.getByTestId('m08-ai-traits')).getAllByTestId('m08-ai-trait').map((x) => x.getAttribute('data-id'))).toEqual(['trait-2', 'trait-5']);
    expect(within(screen.getByTestId('m08-ai-classic')).getAllByTestId('m08-hu-card')).toHaveLength(8);
    const lessons = within(screen.getByTestId('m08-ai-lessons')).getAllByTestId('m08-ai-lesson');
    expect(lessons).toHaveLength(7);
    for (const l of lessons) expect(within(l).getByTestId('m08-lesson-sources').querySelector('a[href^="https://"]')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-IAEA-AI')).toBeTruthy(), W);
    expect(screen.getByTestId('benchmark-chip-IAEA-1917')).toBeTruthy();
    expect(screen.getByTestId('benchmark-chip-AI-LIT')).toBeTruthy();
    expect(screen.getByTestId('m08-ai-speakup').getAttribute('href')).toContain('/speak-up');
  }, 150000);
  it('"which tool fits this moment?" lists matching cards with reasons, and switches with the chosen moment', async () => {
    await renderPage(<AiSafetyCulturePage />, { persona: 'k-ro', path: '/my/safety-culture/ai' });
    const fit = await screen.findByTestId('m08-ai-fit', {}, W);
    expect(within(fit).getAllByTestId('m08-ai-fit-item')[0].getAttribute('data-id')).toBe('hu-ai-verify');
    fireEvent.click(screen.getByTestId('m08-ai-sit-mode'));
    await waitFor(() => expect(within(fit).getAllByTestId('m08-ai-fit-item')[0].getAttribute('data-id')).toBe('hu-ai-mode'), W);
    fireEvent.click(screen.getByTestId('m08-ai-why-hu-ai-mode'));
    const panel = await screen.findByTestId('m08-ai-why-hu-ai-mode-panel', {}, W);
    expect(panel.textContent).toMatch(/This tool is for moments when/);
    expect(panel.textContent).toMatch(/Written for work with AI/);
  }, 60000);
  it('the page reads in Arabic', async () => {
    await renderPage(<AiSafetyCulturePage />, { persona: 'k-ro', path: '/ar/my/safety-culture/ai' });
    await screen.findByTestId('m08-ai-cards', {}, W);
    expect(document.body.textContent).toContain('فحص انحياز الأتمتة');
    expect(document.body.textContent).toContain('التحقق مقابل المصدر الخاضع للرقابة');
    expect(document.body.textContent).toContain('دروس دولية عن الأتمتة والأنظمة الرقمية');
  }, 60000);
  it('the lead console shows every card ready and blocks saving a card with no drill or lesson', async () => {
    await renderPage(<HuToolsAdminPage />, { persona: 'training-mgr', path: '/admin/hu-tools' });
    const table = await screen.findByTestId('m08-adm-table', {}, W);
    await waitFor(() => expect(table.querySelector('table')!.querySelectorAll(":scope > tbody > tr").length).toBe(12), W);
    expect(within(table).queryAllByTestId('m08-adm-problem')).toHaveLength(0);
    expect(within(screen.getByTestId('m08-adm-tiles')).getAllByTestId('stat-tile')[0].textContent).toMatch(/12 \/ 12/);
    expect(screen.getByTestId('m08-adm-lessons').querySelectorAll('tbody tr').length).toBe(7);
    fireEvent.click(within(table).getAllByTestId('m08-adm-edit').find((x) => x.getAttribute('data-id') === 'hu-ai-reliance')!);
    const ed = await screen.findByTestId('m08-adm-editor', {}, W);
    expect((screen.getByTestId('m08-adm-save') as HTMLButtonElement).disabled).toBe(false);
    for (const box of [...within(screen.getByTestId('m08-adm-drills')).getAllByRole('checkbox'), ...within(screen.getByTestId('m08-adm-lesson-links')).getAllByRole('checkbox')]) if ((box as HTMLInputElement).checked) fireEvent.click(box);
    await waitFor(() => expect(within(ed).getByTestId('m08-adm-check').textContent).toMatch(/Link at least one drill or lesson/), W);
    expect((screen.getByTestId('m08-adm-save') as HTMLButtonElement).disabled).toBe(true);
  }, 60000);
  it('the learning page links the AI page, shows the AI behaviours of questioning attitude and every HU refresher with its links', async () => {
    await renderPage(<MySafetyCulturePage />, { persona: 'k-ro', path: '/my/safety-culture' });
    const traits = await screen.findByTestId('m08-my-traits', {}, W);
    expect(screen.getByTestId('m08-my-to-ai').getAttribute('href')).toContain('/my/safety-culture/ai');
    fireEvent.click(within(traits).getByText('Questioning attitude'));
    await waitFor(() => expect(screen.getByTestId('m08-my-trait-ai').textContent).toMatch(/how the tool knows/), W);
    fireEvent.click(screen.getByRole('tab', { name: /HU tool refreshers/ }));
    const hu = await screen.findByTestId('m08-hu-refreshers', {}, W);
    const items = within(hu).getAllByTestId('m08-my-hu');
    expect(items).toHaveLength(12);
    for (const it of items) expect(within(it).queryAllByTestId('m08-hu-drill').length + within(it).queryAllByTestId('m08-hu-lesson').length).toBeGreaterThanOrEqual(1);
  }, 60000);
  it('the public page lists the AI-era tools for everyone (no staff link for anonymous visitors)', async () => {
    await renderPage(<SafetyCulturePage />, { persona: null, path: '/safety-culture' });
    const ai = await screen.findByTestId('m08-hu-ai', {}, W);
    expect(within(ai).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.queryByTestId('m08-sc-to-ai')).toBeNull();
    expect(screen.getByTestId('m08-hu').textContent).not.toMatch(/Automation bias check.*Automation bias check/s);
  }, 60000);
  it('an OE lesson on automation shows its public source in the drawer', async () => {
    await renderPage(<OePage />, { persona: 'k-ro', path: '/oe?lesson=oe-ai-03' });
    const src = await screen.findByTestId('m08-oe-sources', {}, W);
    expect(src.querySelector('a')!.getAttribute('href')).toBe('https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1917_web.pdf');
    expect(src.textContent).toMatch(/2020/);
    expect(screen.getByTestId('m08-oe-to-ai')).toBeTruthy();
  }, 60000);
  it('the speak-up network check stays green: /speak-up renders with no fetch, no RPC and no write', async () => {
    const b = getLocalBackend();
    await renderPage(<SpeakUpPage />, { persona: 'k-ro', path: '/speak-up' });
    await screen.findByTestId('m08-ecp-channels', {}, W);
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as never);
    const rpcSpies = Object.keys(b.rpc).filter((k) => typeof (b.rpc as never)[k] === 'function').map((k) => vi.spyOn(b.rpc as never, k as never));
    const writes = [vi.spyOn(b, 'insert' as never), vi.spyOn(b, 'update' as never), vi.spyOn(b, 'rawInsert' as never), vi.spyOn(b, 'rawUpdate' as never)];
    const audit0 = b.raw('audit_events').length;
    fireEvent.click(screen.getByTestId('m08-speak-anonymous'));
    await new Promise((r) => setTimeout(r, 300));
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const s of rpcSpies) expect(s).not.toHaveBeenCalled();
    for (const w of writes) expect(w).not.toHaveBeenCalled();
    expect(b.raw('audit_events').length).toBe(audit0);
    expect(document.body.textContent).not.toMatch(/Automation bias|Which tool fits/);
    vi.restoreAllMocks();
  }, 60000);
});
