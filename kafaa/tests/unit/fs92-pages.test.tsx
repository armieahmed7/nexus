// @vitest-environment jsdom
/** FS80 pages rendered with the real providers and the in-memory LocalBackend: the gallery (approved entries only, metadata-only notice,
 *  register links, adoption counters, filters, FS80 chips) in EN and AR, an entry adopted end to end (ConfirmDialog, counter, the
 *  builder's first credit), the builder's own entry (no self-adoption), my builds (returned note, editor with the metadata-only check)
 *  and the AI governance review (queue with checklist, maker-checker, approve). */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import seed from '../../src/seed/seed.json';
import GalleryPage from '../../src/modules/m29/GalleryPage';
import AutomationPage from '../../src/modules/m29/AutomationPage';
import MyBuildsPage from '../../src/modules/m29/MyBuildsPage';
import GalleryAdminPage from '../../src/modules/m29/GalleryAdminPage';
import SystemPage from '../../src/modules/m29/SystemPage';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const W = { timeout: 30000 };
const APPROVED = T.automations.filter((a) => a.status === 'approved').length;

describe('FS80 pages', () => {
  it('staff see the approved entries only, each with its register row, counter and why, the metadata-only notice and the FS80 chips', async () => {
    await renderPage(<GalleryPage />, { persona: 'k-ro', path: '/workforce/ai-automations' });
    const list = await screen.findByTestId('m29-atm-list', {}, { timeout: 90000 });
    const cards = within(list).getAllByTestId('m29-atm-card');
    expect(cards.length).toBe(APPROVED);
    expect(cards[0].getAttribute('data-id')).toBe('atm-procedure-revision-digest');
    expect(within(cards[0]).getByTestId('m29-atm-counter').getAttribute('data-n')).toBe('14');
    expect(cards.every((c) => within(c).getByTestId('m29-atm-system').getAttribute('data-system'))).toBe(true);
    expect(screen.getByTestId('m29-atm-metadata').textContent).toMatch(/nothing runs in Kafa'a/);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-UAE-PEERS')).toBeTruthy(), W);
    expect(screen.getByTestId('benchmark-chip-AI-LIT')).toBeTruthy();
    fireEvent.click(within(cards[0]).getByTestId('m29-atm-why'));
    expect(document.body.textContent).toMatch(/Approved by AI governance on/);
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'agent' } });
    await waitFor(() => expect(within(screen.getByTestId('m29-atm-list')).getAllByTestId('m29-atm-card').every((c) => within(c).getByTestId('m29-atm-kind').getAttribute('data-kind') === 'agent')).toBe(true), W);
  }, 150000);
  it('the gallery in Arabic', async () => {
    await renderPage(<GalleryPage />, { persona: 'k-ro', path: '/ar/workforce/ai-automations' });
    await screen.findByTestId('m29-atm-list', {}, W);
    expect(document.body.textContent).toContain('بيانات وصفية فقط');
    expect(document.body.textContent).toContain('كيف يعمل رصيد البنّاء');
  }, 60000);
  it('adopting an approved entry with no adopter yet: ConfirmDialog, counter 1 and the builder\'s first credit (level 2)', async () => {
    await renderPage(<AutomationPage />, { persona: 'k-ro', path: '/workforce/ai-automations/atm-bilingual-notice', route: '/workforce/ai-automations/:id' });
    await screen.findByTestId('m29-atm-one', {}, W);
    expect(screen.getByTestId('m29-atm-credit').getAttribute('data-level')).toBe('0');
    expect(screen.getByTestId('m29-atm-system').getAttribute('data-system')).toBe('ais-drafting');
    fireEvent.click(screen.getByTestId('m29-atm-adopt'));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
    await waitFor(() => expect(screen.getByTestId('m29-atm-counter').getAttribute('data-n')).toBe('1'), W);
    expect(screen.getByTestId('m29-atm-credit').getAttribute('data-level')).toBe('2');
    expect(screen.getByTestId('m29-atm-adopted')).toBeTruthy();
  }, 90000);
  it('a builder opening their own entry cannot adopt it and sees the history', async () => {
    await renderPage(<AutomationPage />, { persona: 'outage-planner', path: '/workforce/ai-automations/atm-outage-lookahead', route: '/workforce/ai-automations/:id' });
    await screen.findByTestId('m29-atm-one', {}, W);
    expect(screen.queryByTestId('m29-atm-adopt')).toBeNull();
    expect(screen.getByTestId('m29-atm-block').getAttribute('data-code')).toBe('own_build');
    expect(screen.getByTestId('m29-atm-credit').getAttribute('data-level')).toBe('3');
    expect(screen.getByTestId('m29-atm-history').textContent).toMatch(/Approved/);
  }, 60000);
  it('my builds: the returned entry shows governance\'s note; the editor refuses a link before sending (metadata only)', async () => {
    await renderPage(<MyBuildsPage />, { persona: 'nse', path: '/my/ai-fluency/builds' });
    const list = await screen.findByTestId('m29-atm-my-list', {}, W);
    const items = within(list).getAllByTestId('m29-atm-my-item');
    expect(items.map((i) => i.getAttribute('data-status')).sort()).toEqual(['approved', 'returned']);
    expect(screen.getByTestId('m29-atm-my-note').textContent).toMatch(/Name the person who checks/);
    fireEvent.click(screen.getByTestId('m29-atm-new'));
    const ed = await screen.findByTestId('m29-atm-editor', {}, W);
    expect(screen.getByTestId('m29-atm-check').getAttribute('data-problem')).toBe('title');
    expect((screen.getByTestId('m29-atm-submit') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('Cancel'));
    const ret = within(screen.getByTestId('m29-atm-my-list')).getAllByTestId('m29-atm-my-item').find((i) => i.getAttribute('data-status') === 'returned')!;
    fireEvent.click(within(ret).getByTestId('m29-atm-edit'));
    const ed2 = await screen.findByTestId('m29-atm-editor', {}, W);
    expect(screen.getByTestId('m29-atm-check').getAttribute('data-problem')).toBe('none');
    const how = within(ed2).getAllByRole('textbox').find((x) => (x as HTMLInputElement).name === 'how_en')!;
    fireEvent.change(how, { target: { value: 'Open https://x.example/run after each meeting.' } });
    expect(screen.getByTestId('m29-atm-check').getAttribute('data-problem')).toBe('code');
    expect(screen.getByTestId('m29-atm-check').textContent).toMatch(/Metadata only/);
    expect((screen.getByTestId('m29-atm-submit') as HTMLButtonElement).disabled).toBe(true);
  }, 60000);
  it('AI governance reviews the queue with the checklist and approves an entry (ConfirmDialog)', async () => {
    await renderPage(<GalleryAdminPage />, { persona: 'ai-governance', path: '/admin/ai-automations' });
    const queue = await screen.findByTestId('m29-atm-queue', {}, W);
    const items = within(queue).getAllByTestId('m29-atm-queue-item');
    expect(items.length).toBe(2);
    expect(within(items[0]).getByTestId('m29-atm-checklist').querySelectorAll('[data-check]').length).toBe(6);
    const eng = items.find((i) => i.getAttribute('data-id') === 'atm-eng-change-impact')!;
    fireEvent.click(within(eng).getByTestId('m29-atm-approve'));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
    await waitFor(() => expect(within(screen.getByTestId('m29-atm-queue')).getAllByTestId('m29-atm-queue-item').length).toBe(1), W);
    await waitFor(() => expect(screen.getByTestId('m29-atm-adm-table').querySelector('table')!.querySelectorAll(':scope > tbody > tr').length).toBeGreaterThanOrEqual(10), W);
  }, 90000);
  it('the FS36 system page lists the approved automations that run on it', async () => {
    await renderPage(<SystemPage />, { persona: 'k-ro', path: '/workforce/ai-register/ais-doc-search', route: '/workforce/ai-register/:id' });
    const box = await screen.findByTestId('m29-sys-automations', {}, W);
    await waitFor(() => expect(within(box).getAllByTestId('m29-atm-kind').length).toBe(T.automations.filter((a) => a.status === 'approved' && a.system_id === 'ais-doc-search').length), W);
  }, 60000);
});
