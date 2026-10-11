// @vitest-environment jsdom
/** FS36/FS37 pages rendered with the real providers and the in-memory LocalBackend: the register for HR (coverage, labels, suppression)
 *  and for staff (systems I use, coverage hidden) in EN and AR, a system page, the pack (statement, exports), the register editor, the
 *  drills list, a drill end to end (flag with kinds, protocol, confirm, scored result with capped evidence) and the training bank. Every
 *  page shows its benchmark chips. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import seed from '../../src/seed/seed.json';
import RegisterPage from '../../src/modules/m29/RegisterPage';
import SystemPage from '../../src/modules/m29/SystemPage';
import PackPage from '../../src/modules/m29/PackPage';
import RegisterAdminPage from '../../src/modules/m29/RegisterAdminPage';
import DrillsPage from '../../src/modules/m29/DrillsPage';
import DrillPage from '../../src/modules/m29/DrillPage';
import TrainingDrillsPage from '../../src/modules/m29/TrainingDrillsPage';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const W = { timeout: 30000 };

describe('FS36/FS37 pages', () => {
  it('HR sees the register with computed coverage, the 80% line, label checks and the FS36 chips', async () => {
    await renderPage(<RegisterPage />, { persona: 'chco', path: '/workforce/ai-register' });
    const list = await screen.findByTestId('m29-reg-list', {}, { timeout: 90000 });
    expect(within(list).getAllByTestId('m29-reg-system').length).toBe(6);
    await waitFor(() => expect(within(list).getAllByTestId('m29-reg-cov').length).toBeGreaterThanOrEqual(5), W);
    expect(screen.getByTestId('m29-reg-label-ok')).toBeTruthy();
    expect(screen.getByTestId('m29-reg-voluntary').textContent).toMatch(/not a regulator/);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-AI-LIT')).toBeTruthy(), W);
    expect(screen.getByTestId('benchmark-chip-UAE-AI')).toBeTruthy();
    fireEvent.click(screen.getByTestId('m29-reg-filter-provider'));
    expect(within(screen.getByTestId('m29-reg-list')).getAllByTestId('m29-reg-system').length).toBe(1);
  }, 150000);
  it('staff see the systems they use with their own requirement, and no coverage figures (Arabic)', async () => {
    await renderPage(<RegisterPage />, { persona: 'k-ro', path: '/ar/workforce/ai-register' });
    const mine = await screen.findByTestId('m29-reg-mine', {}, W);
    expect(within(mine).getAllByTestId('m29-reg-mine-row').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryAllByTestId('m29-reg-cov').length).toBe(0);
    expect(screen.getAllByTestId('m29-reg-nocov').length).toBe(6);
    expect(document.body.textContent).toContain('سجل الإلمام بالذكاء الاصطناعي');
    expect(document.body.textContent).toContain('ليست جهة تنظيمية');
  }, 60000);
  it('a system page shows its groups, a suppressed small group and its measures (auditor)', async () => {
    await renderPage(<SystemPage />, { persona: 'k-auditor', path: '/workforce/ai-register/ais-dalil', route: '/workforce/ai-register/:id' });
    const groups = await screen.findByTestId('m29-sys-groups', {}, W);
    expect(groups.querySelector('table')!.querySelectorAll(':scope > tbody > tr').length).toBe(3);
    await waitFor(() => expect(within(groups).getAllByTestId('m29-reg-suppressed').length).toBeGreaterThanOrEqual(1), W);
    expect(within(screen.getByTestId('m29-sys-measures')).getAllByRole('link').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('m29-sys-oversight').textContent).toMatch(/Retrieval only/);
  }, 60000);
  it('the pack carries the not-a-regulator, voluntary-alignment statement and offers JSON and CSV exports', async () => {
    await renderPage(<PackPage />, { persona: 'k-admin', path: '/workforce/ai-literacy-pack' });
    const st = await screen.findByTestId('m29-pack-statement', {}, W);
    expect(st.getAttribute('data-not-regulator')).toBe('true');
    expect(st.getAttribute('data-voluntary')).toBe('true');
    expect(st.textContent).toMatch(/voluntary alignment/);
    expect(screen.getByTestId('m29-pack-json')).toBeTruthy();
    expect(screen.getByTestId('m29-pack-csv')).toBeTruthy();
    expect(within(screen.getByTestId('m29-pack-systems')).getAllByRole('listitem').length).toBeGreaterThanOrEqual(7);
  }, 60000);
  it('AI governance maintains the register: every entry (drafts and retired too) and an editor with groups', async () => {
    await renderPage(<RegisterAdminPage />, { persona: 'ai-governance', path: '/admin/ai-register' });
    const table = await screen.findByTestId('m29-adm-table', {}, W);
    await waitFor(() => expect(table.querySelector('table')!.querySelectorAll(':scope > tbody > tr').length).toBe(8), W);
    fireEvent.click(screen.getByTestId('m29-adm-add'));
    const ed = await screen.findByTestId('m29-adm-editor', {}, W);
    expect(within(ed).getAllByTestId('m29-adm-group').length).toBe(1);
    fireEvent.click(within(ed).getByTestId('m29-adm-add-group'));
    expect(within(ed).getAllByTestId('m29-adm-group').length).toBe(2);
  }, 60000);
  it('the drills list shows my latest result per drill and the FS37 chips (qc-inspector: one pass, one not yet)', async () => {
    await renderPage(<DrillsPage />, { persona: 'qc-inspector', path: '/my/ai-fluency/drills' });
    const list = await screen.findByTestId('m29-dr-list', {}, W);
    const cards = within(list).getAllByTestId('m29-dr-card');
    expect(cards.length).toBe(6);
    expect(cards.find((c) => c.getAttribute('data-id') === 'ad-valve-lineup')!.getAttribute('data-state')).toBe('passed');
    expect(cards.find((c) => c.getAttribute('data-id') === 'ad-mov-pm')!.getAttribute('data-state')).toBe('not_yet');
    expect(screen.getByTestId('m29-dr-synthetic').textContent).toMatch(/synthetic/i);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-IAEA-AI')).toBeTruthy(), W);
  }, 60000);
  it('a drill runs end to end: flag with kinds, protocol, confirm, scored result with level-1 evidence', async () => {
    await renderPage(<DrillPage />, { persona: 'k-ro', path: '/my/ai-fluency/drills/ad-valve-lineup', route: '/my/ai-fluency/drills/:id' });
    const doc = await screen.findByTestId('m29-drill-doc', {}, W);
    expect(doc.getAttribute('data-synthetic')).toBe('true');
    expect(doc.textContent).toMatch(/SYNTHETIC/);
    const key = T.ai_drill_keys.find((k) => k.drill_id === 'ad-valve-lineup')!;
    for (const e of key.errors) {
      const seg = screen.getAllByTestId('m29-drill-seg').find((x) => x.getAttribute('data-seg') === e.segment_id)!;
      fireEvent.click(within(seg).getByTestId('m29-drill-flag'));
      fireEvent.click(within(seg).getByTestId(`m29-drill-kind-${e.kind}`));
    }
    fireEvent.click(screen.getByTestId('m29-drill-next'));
    for (const k of key.protocol) fireEvent.click(await screen.findByTestId(`m29-drill-opt-${k.id}-${k.correct}`, {}, W));
    fireEvent.click(screen.getByTestId('m29-drill-submit'));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
    const res = await screen.findByTestId('m29-drill-result', {}, W);
    expect(res.getAttribute('data-passed')).toBe('yes');
    expect(res.getAttribute('data-level')).toBe('1');
    expect(screen.getByTestId('m29-drill-evidence').getAttribute('data-level')).toBe('1');
    expect(within(screen.getByTestId('m29-drill-res-errors')).getAllByRole('listitem').every((li) => li.getAttribute('data-found') === 'yes')).toBe(true);
    fireEvent.click(screen.getByTestId('m29-drill-why'));
    expect((await screen.findByTestId('m29-drill-why-panel')).textContent).toMatch(/You found 3 of 3/);
  }, 90000);
  it('the training bank shows every drill with its key and suppressed statistics (training manager)', async () => {
    await renderPage(<TrainingDrillsPage />, { persona: 'training-mgr', path: '/training/ai-drills' });
    const table = await screen.findByTestId('m29-tdr-table', {}, W);
    expect(table.querySelector('table')!.querySelectorAll(':scope > tbody > tr').length).toBe(7);
    fireEvent.click(within(table).getAllByTestId('m29-tdr-key')[0]);
    expect((await screen.findByTestId('m29-tdr-keyview', {}, W)).textContent).toMatch(/s2/);
    expect(screen.getByTestId('m29-tdr-missed')).toBeTruthy();
    expect(within(table).getAllByTestId('m29-tdr-edit').length).toBe(7);
  }, 60000);
});
