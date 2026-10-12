// @vitest-environment jsdom
/** FS70 / FS71 / FS72 pages with the real providers and the in-memory LocalBackend: the published Skills on the Rise list (signals,
 *  moved by, suppressed cells, "Why this?", past quarters), the public method page, the HR workbench (compute, publish with confirmation,
 *  the pulse aggregate, suggestion counts and fairness), the manager pulse, technologies in demand (hot vs my role), the technology admin
 *  (brand refused before sending), "Skills you may have" (confirm into claimed evidence, reject hidden for 180 days), and Arabic. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import SkillsRisingPage from '../../src/modules/m28/SkillsRisingPage';
import SignalsMethodPage from '../../src/modules/m28/SignalsMethodPage';
import SkillSignalsWorkbenchPage from '../../src/modules/m28/SkillSignalsWorkbenchPage';
import ManagerPulsePage from '../../src/modules/m28/ManagerPulsePage';
import TechnologiesPage from '../../src/modules/m28/TechnologiesPage';
import TechnologiesAdminPage from '../../src/modules/m28/TechnologiesAdminPage';
import SuggestionsPage from '../../src/modules/m28/SuggestionsPage';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const W = { timeout: 15000 };
const confirm = async () => fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
const clock = (day: string) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(`${day}T09:00:00Z`)); };
afterEach(() => { vi.useRealTimers(); });

describe('FS70-FS72 pages', { timeout: 60000 }, () => {
  it('FS70 page: staff see the latest list with each skill\'s signals, what moved it and why; past quarters stay', async () => {
    await renderPage(<SkillsRisingPage />, { persona: 'k-ro', path: '/skills/rising' });
    const page = await screen.findByTestId('m28-rs', {}, W);
    expect(page.getAttribute('data-quarter')).toBe('2026-Q3');
    const rows = screen.getAllByTestId('m28-rs-row');
    expect(rows.length).toBeGreaterThan(3);
    for (const r of rows) {
      expect(within(r).getAllByTestId('m28-rs-signal').length).toBe(3);
      expect((r.getAttribute('data-moved') ?? '').length).toBeGreaterThan(0);
      expect(within(r).getByTestId('m28-rs-movedby').textContent).toMatch(/Moved by: /);
    }
    expect(screen.getAllByTestId('m28-rs-signal').some((c) => c.getAttribute('data-value') === '' && /suppressed/.test(c.textContent ?? ''))).toBe(true);
    fireEvent.click(within(rows[0]).getByTestId('m28-rs-why'));
    expect((await screen.findByTestId('m28-rs-why-panel', {}, W)).textContent).toMatch(/opportunities|people/);
    fireEvent.click(within(screen.getByTestId('m28-rs-quarters')).getByText(/2025 Q4/));
    await waitFor(() => expect(screen.getByTestId('m28-rs').getAttribute('data-quarter')).toBe('2025-Q4'));
    expect(screen.getByTestId('m28-rs-published').textContent).toMatch(/2025 Q4 list, published/);
    expect(document.body.textContent).toMatch(/LinkedIn|WEF|SkillsFuture/);
  });

  it('FS70 method page: publishes how each signal is counted, the thresholds and the pulse question (public)', async () => {
    await renderPage(<SignalsMethodPage />, { persona: null, path: '/skills/rising/method' });
    const rules = await screen.findByTestId('m28-sm-rules', {}, W);
    expect(rules.querySelectorAll('[data-signal]').length).toBe(3);
    expect(document.body.textContent).toMatch(/under 10 is shown as suppressed/);
    expect(document.body.textContent).toMatch(/25% or more/);
    expect(screen.getByTestId('m28-sm-question').textContent).toMatch(/by 2030/);
    expect(screen.getByTestId('m28-ht-criteria').textContent).toMatch(/At least 6 distinct/);
  });

  it('FS70 workbench: HR computes an ended quarter, publishes it after confirming, and reads the pulse as an aggregate', async () => {
    clock('2026-10-12');
    await renderPage(<SkillSignalsWorkbenchPage />, { persona: 'chco', path: '/workforce/skill-signals' });
    const list = await screen.findByTestId('m28-sw-list', {}, W);
    fireEvent.change(within(list).getByLabelText('Quarter'), { target: { value: '2025-Q3' } });
    fireEvent.click(screen.getByTestId('m28-sw-compute'));
    const prev = await screen.findByTestId('m28-sw-preview', {}, W);
    expect(prev.getAttribute('data-quarter')).toBe('2025-Q3');
    fireEvent.click(await screen.findByTestId('m28-sw-publish', {}, W));
    await confirm();
    await waitFor(() => expect(getLocalBackend().raw('skill_signal_runs' as never).some((r: Row) => r.quarter === '2025-Q3')).toBe(true), W);
    fireEvent.click(screen.getByRole('tab', { name: 'Manager pulse' }));
    const sum = await screen.findByTestId('m28-sw-pulse-summary', {}, W);
    expect(sum.textContent).toMatch(/Answers/);
    expect(sum.textContent).toMatch(/Median/);
    fireEvent.click(screen.getByRole('tab', { name: 'Skill suggestions' }));
    const st = await screen.findByTestId('m28-sw-stats', {}, W);
    expect(st.getAttribute('data-suppressed')).toBe('1');
    expect(st.textContent).toMatch(/suppressed/);
  });

  it('FS70 manager pulse: a line manager answers this year\'s question after confirming; only an aggregate reaches HR', async () => {
    clock('2026-10-12');
    await renderPage(<ManagerPulsePage />, { persona: 'sro', path: '/my/manager-pulse' });
    const page = await screen.findByTestId('m28-mp', {}, W);
    expect(page.getAttribute('data-open')).toBe('1');
    fireEvent.change(within(screen.getByTestId('m28-mp-share')).getByRole('spinbutton'), { target: { value: '40' } });
    expect(screen.getByTestId('m28-mp-band').textContent).toMatch(/40-59%/);
    fireEvent.click(screen.getByTestId('m28-mp-submit'));
    await confirm();
    await waitFor(() => expect(getLocalBackend().raw('manager_pulse' as never).some((r: Row) => r.person_id === 'p-sro' && r.share_pct === 40)).toBe(true), W);
    expect((await screen.findByTestId('m28-mp-mine', {}, W)).textContent).toMatch(/40%/);
    expect(document.body.textContent).toMatch(/at least 10 managers/);
  });

  it('FS71 page: hot across ENEC is separate from in demand for my role, each with its counts and criteria; no brands', async () => {
    await renderPage(<TechnologiesPage />, { persona: 'k-ro', path: '/skills/technologies' });
    const hot = await screen.findByTestId('m28-ht-hot', {}, W);
    const cards = within(hot).getAllByTestId('m28-ht-badge');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.getAttribute('data-scope') === 'enec')).toBe(true);
    expect(within(cards[0]).getByTestId('m28-ht-counts').textContent).toMatch(/sources/);
    fireEvent.click(within(cards[0]).getByTestId('m28-ht-why'));
    expect((await screen.findByTestId('m28-ht-why-panel', {}, W)).textContent).toMatch(/job families/);
    expect(screen.getByTestId('m28-ht-criteria')).toBeTruthy();
    expect(document.body.textContent).toMatch(/refuses vendor and product names/);
    const role = screen.queryByTestId('m28-ht-roles');
    if (role) expect(within(role).getAllByTestId('m28-ht-badge').every((c) => c.getAttribute('data-scope') === 'role')).toBe(true);
    fireEvent.click(within(screen.getByTestId('m28-ht-quarters')).getByText(/2026 Q2/));
    await waitFor(() => expect(screen.getByTestId('m28-ht').getAttribute('data-quarter')).toBe('2026-Q2'));
  });

  it('FS71 admin: a vendor brand is flagged in the form and never sent; a generic technology saves after confirming', async () => {
    await renderPage(<TechnologiesAdminPage />, { persona: 'training-mgr', path: '/admin/skills/technologies' });
    expect((await screen.findAllByTestId('m28-hta-row', {}, W)).length).toBeGreaterThanOrEqual(15);
    fireEvent.click(screen.getByTestId('m28-hta-new'));
    const form = await screen.findByTestId('m28-hta-form', {}, W);
    const set = (label: string, v: string) => fireEvent.change(within(form).getByLabelText(new RegExp(label)), { target: { value: v } });
    set('^Id', 'tech-log-search');
    set('Name \\(English\\)', 'Splunk log search');
    set('Name \\(Arabic\\)', 'بحث السجلات');
    set('Description \\(English\\)', 'Searching plant event logs to find patterns across systems.');
    set('Description \\(Arabic\\)', 'البحث في سجلات أحداث المحطة لإيجاد الأنماط عبر الأنظمة.');
    fireEvent.change(within(form).getByLabelText(/^Category/), { target: { value: 'analytics' } });
    expect((await screen.findByTestId('m28-hta-brand', {}, W)).textContent).toMatch(/splunk/i);
    const before = getLocalBackend().raw('audit_events' as never).length;
    fireEvent.click(screen.getByTestId('m28-hta-save'));
    expect(screen.queryByTestId('confirm-action')).toBeNull();
    expect(getLocalBackend().raw('audit_events' as never).length).toBe(before);
    set('Name \\(English\\)', 'Plant log search');
    await waitFor(() => expect(screen.queryByTestId('m28-hta-brand')).toBeNull());
    fireEvent.click(screen.getByTestId('m28-hta-save'));
    await confirm();
    await waitFor(() => expect(getLocalBackend().raw('technologies' as never).some((r: Row) => r.id === 'tech-log-search')).toBe(true), W);
  });

  it('FS72 page: my suggestions with reasons; confirm adds claimed evidence; reject hides it for 180 days', async () => {
    clock('2026-10-12');
    await renderPage(<SuggestionsPage />, { persona: 'k-ro', path: '/my/skills/suggestions' });
    const cards = await screen.findAllByTestId('m28-ssg-card', {}, W);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(6);
    expect(screen.getByText('Deterministic engine')).toBeTruthy();
    fireEvent.click(within(cards[0]).getByTestId('m28-ssg-why'));
    expect((await screen.findByTestId('m28-ssg-why-panel', {}, W)).textContent?.length).toBeGreaterThan(10);
    const skill = cards[0].getAttribute('data-skill')!;
    fireEvent.click(within(cards[0]).getByTestId('m28-ssg-confirm'));
    await confirm();
    await waitFor(() => expect(getLocalBackend().raw('skill_evidence' as never).some((e: Row) => e.person_id === 'p-k-ro' && e.skill_id === skill && e.ref_table === 'skill_suggestions' && e.basis === 'claimed')).toBe(true), W);
    const second = (await screen.findAllByTestId('m28-ssg-card', {}, W)).find((c) => c.getAttribute('data-skill') !== skill)!;
    const skill2 = second.getAttribute('data-skill')!;
    fireEvent.click(within(second).getByTestId('m28-ssg-reject'));
    expect(document.body.textContent).toMatch(/hidden for 180 days/);
    await confirm();
    const answered = await screen.findByTestId('m28-ssg-answered', {}, W);
    await waitFor(() => expect(answered.querySelector(`[data-skill="${skill2}"]`)?.getAttribute('data-status')).toBe('rejected'), W);
    expect(answered.querySelector(`[data-skill="${skill2}"]`)?.textContent).toMatch(/hidden until/);
    expect(screen.getByTestId('m28-ssg-points').querySelectorAll('[data-source]').length).toBe(5);
    expect(document.body.textContent).toMatch(/Your manager does not/);
  });

  it('FS72 page: a manager sees only their own suggestions, never a team member\'s', async () => {
    await renderPage(<SuggestionsPage />, { persona: 'sro', path: '/my/skills/suggestions' });
    await screen.findByTestId('m28-ssg', {}, W);
    const own = getLocalBackend().raw('skill_suggestions' as never).filter((r: Row) => r.person_id === 'p-sro' && r.status === 'open').length;
    expect(screen.queryAllByTestId('m28-ssg-card').length).toBe(Math.min(own, 6));
  });

  it('renders in Arabic (Skills on the Rise, technologies and suggestions)', async () => {
    await renderPage(<SkillsRisingPage />, { persona: 'k-ro', path: '/ar/skills/rising' });
    await screen.findByTestId('m28-rs', {}, W);
    expect(document.body.textContent).toMatch(/المهارات الصاعدة/);
    expect(document.body.textContent).toMatch(/مطلوبة الآن/);
    await renderPage(<TechnologiesPage />, { persona: 'k-ro', path: '/ar/skills/technologies' });
    await screen.findAllByTestId('m28-ht-badge', {}, W);
    expect(document.body.textContent).toMatch(/رائجة في المؤسسة/);
    await renderPage(<SuggestionsPage />, { persona: 'k-ro', path: '/ar/my/skills/suggestions' });
    await screen.findAllByTestId('m28-ssg-card', {}, W);
    expect(document.body.textContent).toMatch(/مهارات قد تمتلكها/);
    expect(document.body.textContent).toMatch(/لا تنطبق عليّ/);
  });
});
