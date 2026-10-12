// @vitest-environment jsdom
/** FS66/FS67 pages rendered with the real providers and the in-memory LocalBackend: the university workspace (own programmes only, the
 *  editor with live FS57 coverage), the register and review queue, one programme (coverage, criteria, endorsement with maker-checker and
 *  the evidence it writes), graduate hires (evidence only for endorsed programmes), fellowships (completion rate first, award counts only
 *  beside it, suppression), one fellowship (host project, supervisor role card, sign-off completes it), HR's fellowship programme, and
 *  the Arabic pages. Every page shows its chips. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import seed from '../../src/seed/seed.json';
import en from '../../src/i18n/m10.en.json';
import ar from '../../src/i18n/m10.ar.json';
import ProgrammesWorkspacePage from '../../src/modules/m10/ProgrammesWorkspacePage';
import ProgrammeRegisterPage from '../../src/modules/m10/ProgrammeRegisterPage';
import ProgrammePage from '../../src/modules/m10/ProgrammePage';
import GraduateHiresPage from '../../src/modules/m10/GraduateHiresPage';
import FellowshipsPage from '../../src/modules/m10/FellowshipsPage';
import FellowshipPage from '../../src/modules/m10/FellowshipPage';
import WorkforceFellowshipsPage from '../../src/modules/m10/WorkforceFellowshipsPage';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const TB = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const W = { timeout: 30000 };
const FIRST = { timeout: 90000 };
const raw = (t: string) => getLocalBackend().raw(t as never) as unknown as Row[];
const AR = /[؀-ۿ]/;
/** Every rendered award line sits beside its rate (rate first) in the same pair; a suppressed rate withholds the award count. */
function pairsOk() {
  const pairs = screen.getAllByTestId('m10-fw-pair');
  for (const p of pairs) {
    const kids = [...p.children].map((c) => c.getAttribute('data-testid'));
    expect(kids).toEqual(['m10-fw-rate', 'm10-fw-awarded']);
  }
  expect(screen.getAllByTestId('m10-fw-awarded').length).toBe(pairs.length);
  return pairs.length;
}

describe('FS66 pages', () => {
  it('university workspace: only its own programmes, live coverage in the editor, chips', async () => {
    await renderPage(<ProgrammesWorkspacePage />, { persona: 'k-university', path: '/partner/university/programmes' });
    const list = await screen.findByTestId('m10-ua-list', {}, FIRST);
    const cards = within(list).getAllByTestId(/^m10-ua-card-/);
    const ku = TB.programme_alignments.filter((p) => p.university_org_id === 'ku').map((p) => `m10-ua-card-${p.id}`).sort();
    expect(cards.map((c) => c.getAttribute('data-testid')).sort()).toEqual(ku);
    expect(screen.queryByTestId('m10-ua-card-ua-kings-msc-npp')).toBeNull();
    expect(screen.queryByTestId('m10-ua-edit-ua-ku-bsc-nuc')).toBeNull(); // submitted: locked
    expect(screen.getByTestId('m10-ua-edit-ua-ku-msc-nem')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByTestId('benchmark-chip-NUC-NET')[0]).toBeTruthy(), W);
    fireEvent.click(screen.getByTestId('m10-ua-new'));
    const ed = await screen.findByTestId('m10-ua-editor', {}, W);
    expect(within(ed).getByTestId('m10-ua-coverage')).toBeTruthy();
    expect(within(ed).getByTestId('m10-ua-problem')).toBeTruthy(); // empty draft: the first problem is shown before saving
  }, 150000);

  it('register: review queue of submitted programmes, every programme with its status (lapsed shown)', async () => {
    await renderPage(<ProgrammeRegisterPage />, { persona: 'training-mgr', path: '/training/university-programmes' });
    const queue = await screen.findByTestId('m10-ua-queue', {}, FIRST);
    const submitted = TB.programme_alignments.filter((p) => p.status === 'submitted').map((p) => p.id);
    for (const id of submitted) expect(within(queue).getByTestId(`m10-ua-review-${id}`)).toBeTruthy();
    const reg = screen.getByTestId('m10-ua-register');
    const pills = within(reg).getAllByTestId('m10-ua-status').map((x) => x.getAttribute('data-status'));
    expect(pills.length).toBe(TB.programme_alignments.length);
    expect(pills).toContain('lapsed');
    expect(screen.queryByTestId('m10-ua-add-behalf')).toBeNull(); // partner_org A only
    await waitFor(() => expect(screen.getAllByTestId('benchmark-chip-UAE-NQF')[0]).toBeTruthy(), W);
  }, 150000);

  it('acceptance FS66 (page): the framework owner endorses after the reviewer criteria; evidence is written for the covered graduates only then', async () => {
    await renderPage(<ProgrammePage />, { persona: 'k-admin', path: '/universities/programmes/ua-ku-bsc-nuc', route: '/universities/programmes/:id' });
    const panel = await screen.findByTestId('m10-ua-endorse-panel', {}, FIRST);
    expect(screen.getByTestId('m10-ua-coverage')).toBeTruthy();
    expect(screen.getByTestId('m10-ua-crit-coverage').getAttribute('data-ok')).toBe('yes');
    expect(screen.queryByTestId('m10-ua-graduates')).toBeNull(); // graduate rows are HR's (applications A), not the framework owner's
    expect(raw('skill_evidence').filter((e) => e.ref_table === 'programme_alignments').length).toBe(0);
    const endorse = within(panel).getByTestId('m10-ua-endorse') as HTMLButtonElement;
    expect(endorse.disabled).toBe(true);
    for (const k of ['assessment', 'placement', 'accreditation'] as const) fireEvent.click(within(panel).getByLabelText(en.ua.crit[k]));
    fireEvent.change(within(panel).getByLabelText(en.ua.detail.note), { target: { value: 'Assessment, placement and accreditation verified' } });
    await waitFor(() => expect(endorse.disabled).toBe(false), W);
    fireEvent.click(endorse);
    fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
    await waitFor(() => expect(raw('programme_alignments').find((p) => p.id === 'ua-ku-bsc-nuc')!.status).toBe('endorsed'), W);
    const ev = raw('skill_evidence').filter((e) => e.ref_table === 'programme_alignments');
    expect(ev.length).toBeGreaterThan(0);
    expect(ev.every((e) => e.ref_id === 'ua-ku-bsc-nuc' && e.basis === 'validated' && e.kind === 'credential')).toBe(true);
    await waitFor(() => expect(screen.getAllByTestId('m10-ua-status')[0].getAttribute('data-status')).toBe('endorsed'), W);
  }, 180000);

  it('maker-checker on the page: the submitter sees no decision controls', async () => {
    await renderPage(<ProgrammePage />, { persona: 'ai-governance', path: '/universities/programmes/ua-kings-msc-npp', route: '/universities/programmes/:id' });
    expect(await screen.findByTestId('m10-ua-own-submission', {}, FIRST)).toBeTruthy();
    expect(screen.queryByTestId('m10-ua-endorse')).toBeNull();
    expect(screen.getByTestId('m10-ua-skills')).toBeTruthy();
  }, 150000);

  it('graduate hires: HR records a graduate of an endorsed programme (evidence written) and of a returned one (waits)', async () => {
    await renderPage(<GraduateHiresPage />, { persona: 'chco', path: '/workforce/graduate-hires' });
    const form = await screen.findByTestId('m10-gh-form', {}, FIRST);
    expect(within(screen.getByTestId('m10-gh-table')).getAllByRole('row').length).toBeGreaterThan(TB.programme_graduates.length);
    const lastYear = `${Number(new Date().toISOString().slice(0, 4)) - 1}-06-30`;
    fireEvent.change(within(form).getByLabelText(en.ua.gh.person), { target: { value: 'ap-152' } });
    fireEvent.change(within(form).getByLabelText(en.ua.reg.cProgramme), { target: { value: 'ua-iat-cert-dpo' } });
    fireEvent.change(within(form).getByLabelText(en.ua.gh.graduated), { target: { value: lastYear } });
    fireEvent.click(screen.getByTestId('m10-gh-record'));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
    await waitFor(() => expect(raw('programme_graduates').find((g) => g.id === 'pg-ua-iat-cert-dpo-ap-152')?.status).toBe('evidence_written'), W);
    fireEvent.change(within(form).getByLabelText(en.ua.gh.person), { target: { value: 'ap-153' } });
    fireEvent.change(within(form).getByLabelText(en.ua.reg.cProgramme), { target: { value: 'ua-adpoly-bsc-est' } });
    fireEvent.change(within(form).getByLabelText(en.ua.gh.graduated), { target: { value: lastYear } });
    fireEvent.click(screen.getByTestId('m10-gh-record'));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
    await waitFor(() => expect(raw('programme_graduates').find((g) => g.id === 'pg-ua-adpoly-bsc-est-ap-153')?.status).toBe('awaiting_endorsement'), W);
    expect(raw('skill_evidence').filter((e) => e.ref_table === 'programme_alignments').every((e) => e.ref_id === 'ua-iat-cert-dpo')).toBe(true);
  }, 180000);

  it('renders in Arabic', async () => {
    await renderPage(<ProgrammePage />, { persona: 'k-university', path: '/ar/universities/programmes/ua-ku-bsc-nuc', route: '/ar/universities/programmes/:id' });
    await screen.findByTestId('m10-ua-coverage', {}, FIRST);
    expect(document.body.textContent).toContain(ar.ua.cov.best);
    expect(screen.queryByTestId('m10-ua-graduates')).toBeNull(); // graduates are HR-only
  }, 150000);
});

describe('FS67 pages', () => {
  it('acceptance FS67 (page): completion rate first, award counts only beside it, small groups suppressed', async () => {
    await renderPage(<FellowshipsPage />, { persona: 'chco', path: '/universities/fellowships' });
    const head = await screen.findByTestId('m10-fw-headline', {}, FIRST);
    const overall = within(head).getAllByTestId('m10-fw-rate')[0];
    expect(overall.textContent).toMatch(/\d+%/);
    expect(pairsOk()).toBeGreaterThan(1);
    const sup = within(head).getAllByTestId(/^m10-fw-cell-/).filter((c) => c.getAttribute('data-suppressed') === 'yes');
    expect(sup.length).toBeGreaterThan(0);
    for (const c of sup) { expect(within(c).queryByTestId('m10-fw-awarded')).toBeNull(); expect(c.textContent).toMatch(/suppressed/); }
    // no award count is printed anywhere outside a pair
    const awardedNodes = [...document.querySelectorAll('[data-testid="m10-fw-awarded"]')];
    expect(awardedNodes.every((n) => n.closest('[data-testid="m10-fw-pair"]'))).toBe(true);
    expect(within(screen.getByTestId('m10-fw-list')).getAllByRole('row').length).toBe(TB.fellowships.length + 1);
    await waitFor(() => expect(screen.getAllByTestId('benchmark-chip-NEA')[0]).toBeTruthy(), W);
  }, 150000);

  it('a fellow without the aggregate grant sees only their own fellowship and no stats', async () => {
    await renderPage(<FellowshipsPage />, { persona: 'k-graduate', path: '/universities/fellowships' });
    const list = await screen.findByTestId('m10-fw-list', {}, FIRST);
    expect(within(list).getAllByRole('row').length).toBe(TB.fellowships.filter((f) => f.fellow_person_id === 'p-k-graduate').length + 1);
    expect(screen.queryByTestId('m10-fw-headline')).toBeNull();
    expect(screen.queryByTestId('m10-fw-awarded')).toBeNull();
  }, 150000);

  it('acceptance FS67 (page): the fellowship names its host project and supervisor role card; the supervisor signs off the last milestone and completes it', async () => {
    const fw = TB.fellowships.find((f) => f.id === 'fw-2024-ap-122')!;
    await renderPage(<FellowshipPage />, { persona: 'training-mgr', path: '/universities/fellowships/fw-2024-ap-122', route: '/universities/fellowships/:id' });
    await screen.findByTestId('m10-fw-detail', {}, FIRST);
    expect(screen.getByTestId('m10-fw-host').textContent!.length).toBeGreaterThan(3);
    expect(screen.getByTestId('m10-fw-supervisor').textContent).toBe(fw.supervisor_name_en);
    const pend = TB.fellowship_milestones.find((m) => m.fellowship_id === fw.id && m.status === 'submitted')!;
    fireEvent.click(screen.getByTestId(`m10-fw-sign-${pend.n}`));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
    await waitFor(() => expect(raw('fellowships').find((f) => f.id === fw.id)!.status).toBe('completed'), W);
    await waitFor(() => expect(screen.getByTestId(`m10-fw-ms-status-${pend.n}`).getAttribute('data-status')).toBe('signed_off'), W);
    await waitFor(() => expect(screen.getAllByTestId('benchmark-chip-NUC-NET')[0]).toBeTruthy(), W);
  }, 150000);

  it('HR fellowship programme: breakdowns, every fellowship, the award form checks the supervisor role card first', async () => {
    await renderPage(<WorkforceFellowshipsPage />, { persona: 'chco', path: '/workforce/fellowships' });
    await screen.findByTestId('m10-fw-wf-table', {}, FIRST);
    expect(pairsOk()).toBeGreaterThan(1);
    expect(screen.getByTestId('m10-fw-pre')).toBeTruthy();
    expect((screen.getByTestId('m10-fw-award-btn') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByTestId(/^m10-fw-withdraw-/).length).toBe(TB.fellowships.filter((f) => f.status === 'active').length);
  }, 150000);

  it('renders in Arabic', async () => {
    await renderPage(<FellowshipsPage />, { persona: 'chco', path: '/ar/universities/fellowships' });
    await screen.findByTestId('m10-fw-headline', {}, FIRST);
    expect(screen.getByText(ar.routes['universities-fellowships'].title, { selector: 'h1' })).toBeTruthy();
    expect(AR.test(screen.getAllByTestId('m10-fw-awarded')[0].textContent!)).toBe(true);
  }, 150000);
});
