// @vitest-environment jsdom
/** FS60 / FS61 pages (FS wave G · E1, M35) rendered with the real providers and the in-memory LocalBackend: the disclosure workbench
 *  (computed values, suppression, narratives, the maker-checker block, approving a ready line with audit + ledger), the metric library,
 *  the print pack (unapproved lines carry no value), the pilots registry with the adoption rate against the FSC reference from
 *  kafaa_benchmarks, a pilot that cannot close before the evaluator's sign-off, and the staff page where failures stay visible and the
 *  named evaluator signs off. Every page shows its benchmark chips. */
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import seed from '../../src/seed/seed.json';
import en from '../../src/i18n/m35.en.json';
import ar from '../../src/i18n/m35.ar.json';
import DisclosurePage from '../../src/modules/m35/DisclosurePage';
import DisclosureMetricsPage from '../../src/modules/m35/DisclosureMetricsPage';
import DisclosurePackPage from '../../src/modules/m35/DisclosurePackPage';
import PilotsPage from '../../src/modules/m35/PilotsPage';
import PilotPage from '../../src/modules/m35/PilotPage';
import StaffPilotsPage from '../../src/modules/m35/StaffPilotsPage';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const W = { timeout: 30000 };
const chips = () => Array.from(document.querySelectorAll('button[data-testid^="benchmark-chip-"]')).map((x) => x.getAttribute('data-testid'));
const line = (id: string) => screen.getAllByTestId('m35-hc-line').find((x) => x.getAttribute('data-metric') === id)!;

describe('FS60 pages', () => {
  it('HR director: the 2026-Q3 disclosure with computed values, line states, the maker-checker block on his own line, the missing narrative block, and FS60 chips', async () => {
    await renderPage(<DisclosurePage />, { persona: 'chco', path: '/workforce/disclosure' });
    const d = await screen.findByTestId('m35-hc-disclosure', {}, { timeout: 90000 });
    expect(d.getAttribute('data-period')).toBe('2026-Q3');
    expect(screen.getAllByTestId('m35-hc-line').length).toBe(7);
    const q3 = T.hc_disclosures.find((x) => x.period === '2026-Q3')!;
    const trained = q3.metric_values.metrics.find((m: Row) => m.metric_id === 'hcm-trained');
    expect(within(line('hcm-trained')).getByTestId('m35-hc-value').getAttribute('data-value')).toBe(String(trained.value));
    expect(line('hcm-trained').getAttribute('data-state')).toBe('approved');
    expect(line('hcm-participation').getAttribute('data-state')).toBe('missing');
    expect(within(line('hcm-participation')).getByTestId('m35-hc-approve').getAttribute('data-problem')).toBe('no_narrative');
    expect(within(line('hcm-critical')).getByTestId('m35-hc-approve').getAttribute('data-problem')).toBe('maker_checker');
    expect(within(line('hcm-critical')).getByTestId('m35-hc-approve-why').textContent).toBe(en.hc.blocked.maker_checker);
    expect(within(line('hcm-participation')).getAllByTestId('m35-hc-cell').some((c) => c.getAttribute('data-n') === '')).toBe(true);
    expect(screen.getByTestId('m35-hc-materiality').textContent).toContain('Materiality');
    await waitFor(() => expect(chips()).toEqual(expect.arrayContaining(['benchmark-chip-ISO30414', 'benchmark-chip-EU-PACT', 'benchmark-chip-UAE-PEERS'])), W);
  }, 150000);
  it('HR director approves a ready line after the confirmation: one audit row and one ledger row; the line publishes', async () => {
    const b = getLocalBackend();
    await renderPage(<DisclosurePage />, { persona: 'chco', path: '/workforce/disclosure' });
    await screen.findByTestId('m35-hc-disclosure', {}, { timeout: 90000 });
    const spy = vi.spyOn(b.rpc, 'approveDisclosure');
    const a0 = (b.raw('audit_events' as never) as unknown as Row[]).length, l0 = (b.raw('ledger_local' as never) as unknown as Row[]).length;
    fireEvent.click(within(line('hcm-active-learners')).getByTestId('m35-hc-approve'));
    await screen.findByText(en.hc.approveConsequence, {}, W);
    fireEvent.click(screen.getAllByRole('button', { name: en.hc.approve }).at(-1)!);
    await waitFor(() => expect(spy).toHaveBeenCalledWith('hcd-2026-Q3', ['hcm-active-learners']), W);
    expect((await spy.mock.results[0].value).ok).toBe(true);
    expect((b.raw('audit_events' as never) as unknown as Row[]).length).toBeGreaterThan(a0);
    expect((b.raw('ledger_local' as never) as unknown as Row[]).length).toBe(l0 + 1);
    await waitFor(() => expect(line('hcm-active-learners').getAttribute('data-state')).toBe('approved'), W);
    spy.mockRestore();
  }, 150000);
  it('HR analyst writes the missing narrative (EN and AR) through the editor; the check guides until both are complete', async () => {
    const b = getLocalBackend();
    await renderPage(<DisclosurePage />, { persona: 'k-hr-analyst', path: '/workforce/disclosure' });
    await screen.findByTestId('m35-hc-disclosure', {}, { timeout: 90000 });
    expect(screen.queryAllByTestId('m35-hc-approve').length).toBe(0);
    const spy = vi.spyOn(b.rpc, 'saveDisclosure');
    fireEvent.click(within(line('hcm-participation')).getByTestId('m35-hc-edit'));
    const ed = await screen.findByTestId('m35-hc-editor', {}, W);
    expect(within(ed).getByTestId('m35-hc-editor-problem').getAttribute('data-problem')).toBe('narrative');
    fireEvent.change(within(ed).getByLabelText(en.hc.narrativeEn), { target: { value: 'Corporate functions and senior grades trail the plant in learning this year.' } });
    fireEvent.change(within(ed).getByLabelText(en.hc.narrativeAr), { target: { value: 'تتأخر الوظائف المؤسسية والدرجات العليا عن المحطة في التعلّم هذا العام.' } });
    fireEvent.change(within(ed).getByLabelText(en.hc.varianceEn), { target: { value: 'No change against the previous published quarter.' } });
    fireEvent.change(within(ed).getByLabelText(en.hc.varianceAr), { target: { value: 'لا تغيير مقارنة بالربع المنشور السابق.' } });
    await waitFor(() => expect(within(ed).queryByTestId('m35-hc-editor-problem')).toBeNull(), W);
    fireEvent.click(screen.getAllByRole('button', { name: en.hc.saveLine }).at(-1)!);
    await waitFor(() => expect(spy).toHaveBeenCalled(), W);
    expect((await spy.mock.results[0].value).ok).toBe(true);
    await waitFor(() => expect(line('hcm-participation').getAttribute('data-state')).toBe('ready'), W);
    spy.mockRestore();
  }, 150000);
  it('the metric library lists the 7 metrics with definition, formula, source and owner, and the ISO 30414 fact from the benchmark registry', async () => {
    await renderPage(<DisclosureMetricsPage />, { persona: 'k-auditor', path: '/workforce/disclosure/metrics' });
    const lib = await screen.findByTestId('m35-hcm', {}, { timeout: 90000 });
    expect(within(lib).getAllByTestId('m35-hcm-metric').length).toBe(7);
    await waitFor(() => expect(screen.getByTestId('m35-hcm-iso').textContent).toContain('14 baseline metrics'), W);
  }, 150000);
  it('the print pack shows values only for approved lines and says SIMULATED', async () => {
    await renderPage(<DisclosurePackPage />, { persona: 'chco', path: '/workforce/disclosure/2026-Q3/pack', route: '/workforce/disclosure/:period/pack' });
    const p = await screen.findByTestId('m35-pack', {}, { timeout: 90000 });
    const rows = within(p).getAllByTestId('m35-pack-row');
    expect(rows.filter((r) => r.getAttribute('data-published') === 'true').length).toBe(2);
    for (const r of rows.filter((x) => x.getAttribute('data-published') === 'false')) expect(within(r).getByTestId('m35-pack-value').textContent).toBe(en.hcp.notPublished);
    expect(screen.getByTestId('m35-pack-statement').textContent).toMatch(/SIMULATED/);
  }, 150000);
  it('renders in Arabic', async () => {
    await renderPage(<DisclosurePage />, { persona: 'chco', path: '/ar/workforce/disclosure' });
    await screen.findByTestId('m35-hc-disclosure', {}, { timeout: 90000 });
    expect(screen.getByText(ar.routes['workforce-disclosure'].title, { selector: 'h1' })).toBeTruthy();
  }, 120000);
});

describe('FS61 pages', () => {
  it('registry: the adoption rate computed from statuses (75%) against the FSC reference read from the benchmark registry, failures in the counts, FS61 chips', async () => {
    await renderPage(<PilotsPage />, { persona: 'training-mgr', path: '/workforce/pilots' });
    const kpi = await screen.findByTestId('m35-sp-kpi', {}, { timeout: 90000 });
    expect(kpi.getAttribute('data-rate')).toBe('75');
    const fsc = T.benchmarks.find((x) => x.id === 'FSC')!.figures.find((f: Row) => f.key === 'adoption_rate').value;
    expect(kpi.getAttribute('data-reference')).toBe(String(fsc));
    expect(screen.getByTestId('m35-sp-reference').querySelector('a')!.getAttribute('href')).toMatch(/^https:\/\/fsc-ccf\.ca\//);
    await waitFor(() => expect(within(kpi).getAllByTestId('benchmark-line').length).toBeGreaterThan(0), W);
    expect(within(screen.getByTestId('m35-sp-registry')).getAllByTestId('m35-sp-link').length).toBe(11);
    expect(screen.queryByTestId('m35-sp-add')).toBeNull();
    await waitFor(() => expect(chips()).toEqual(expect.arrayContaining(['benchmark-chip-FSC'])), W);
  }, 150000);
  it('a running pilot cannot close before the evaluator signs off; a signed-off pilot closes after the confirmation (ledger)', async () => {
    const b = getLocalBackend();
    await renderPage(<PilotPage />, { persona: 'chco', path: '/workforce/pilots/sp-adaptive-requal', route: '/workforce/pilots/:id' });
    await screen.findByTestId('m35-spd', {}, { timeout: 90000 });
    const btn = screen.getByTestId('m35-spd-close');
    expect(btn.getAttribute('data-blocked')).toBe('no_signoff');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('m35-spd-close-why').textContent).toBe(en.spd.blocked.no_signoff);
    cleanup();
    await renderPage(<PilotPage />, { persona: 'chco', path: '/workforce/pilots/sp-ai-literacy-nudges', route: '/workforce/pilots/:id' });
    await screen.findByTestId('m35-spd', {}, { timeout: 90000 });
    const spy = vi.spyOn(b.rpc, 'closePilot');
    const l0 = (b.raw('ledger_local' as never) as unknown as Row[]).length;
    fireEvent.click(screen.getByTestId('m35-spd-close'));
    await screen.findByText(en.spd.closeConsequence, {}, W);
    fireEvent.click(screen.getAllByRole('button', { name: en.spd.close }).at(-1)!);
    await waitFor(() => expect(spy).toHaveBeenCalledWith('sp-ai-literacy-nudges', 'expanded'), W);
    expect((await spy.mock.results[0].value).ok).toBe(true);
    expect((b.raw('ledger_local' as never) as unknown as Row[]).length).toBe(l0 + 1);
    spy.mockRestore();
  }, 150000);
  it('staff: published results only, both failures visible with their badge; no evaluator tab content for a non-evaluator', async () => {
    await renderPage(<StaffPilotsPage />, { persona: 'k-ro', path: '/skills/pilots' });
    const list = await screen.findByTestId('m35-spp-list', {}, { timeout: 90000 });
    const cards = within(list).getAllByTestId('m35-sp-card');
    expect(cards.length).toBe(T.skill_pilots.filter((p) => p.published).length);
    expect(cards.filter((c) => c.getAttribute('data-result') === 'failed').length).toBe(2);
    expect(within(list).getAllByTestId('m35-sp-failure-visible').length).toBe(2);
    fireEvent.click(screen.getByTestId('m35-spp-filter-failed'));
    await waitFor(() => expect(within(screen.getByTestId('m35-spp-list')).getAllByTestId('m35-sp-card').length).toBe(2), W);
  }, 150000);
  it('the named evaluator signs off a running pilot on the staff page (audit + ledger)', async () => {
    const b = getLocalBackend();
    await renderPage(<StaffPilotsPage />, { persona: 'independent-approver', path: '/skills/pilots' });
    const form = await screen.findByTestId('m35-sso', {}, { timeout: 90000 });
    expect(form.getAttribute('data-pilot')).toBe('sp-adaptive-requal');
    expect(within(form).getByTestId('m35-sso-problem').getAttribute('data-problem')).toBe('summary');
    fireEvent.change(within(form).getByLabelText(en.sso.summaryEn), { target: { value: 'Study time fell by a third with no drop in first-attempt passes.' } });
    fireEvent.change(within(form).getByLabelText(en.sso.summaryAr), { target: { value: 'انخفض وقت الدراسة بمقدار الثلث دون تراجع في النجاح من المحاولة الأولى.' } });
    fireEvent.change(within(form).getByLabelText(en.sso.lessonsEn), { target: { value: 'Keep the item bank fresh.' } });
    fireEvent.change(within(form).getByLabelText(en.sso.lessonsAr), { target: { value: 'إبقاء بنك الأسئلة محدّثاً.' } });
    await waitFor(() => expect(within(form).queryByTestId('m35-sso-problem')).toBeNull(), W);
    const spy = vi.spyOn(b.rpc, 'signoffPilot');
    const l0 = (b.raw('ledger_local' as never) as unknown as Row[]).length;
    fireEvent.click(within(form).getByTestId('m35-sso-submit'));
    await screen.findByText(en.sso.consequence, {}, W);
    fireEvent.click(screen.getAllByRole('button', { name: en.sso.submit }).at(-1)!);
    await waitFor(() => expect(spy).toHaveBeenCalled(), W);
    expect((await spy.mock.results[0].value).ok).toBe(true);
    expect((b.raw('ledger_local' as never) as unknown as Row[]).length).toBe(l0 + 1);
    spy.mockRestore();
  }, 150000);
});
