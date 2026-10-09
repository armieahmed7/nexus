// @vitest-environment jsdom
/** F27/F29 pages rendered with the real providers and the in-memory LocalBackend: the SAT workbench with its rule card, a role's
 *  task-to-training matrix with highlighted coverage gaps, a restricted task, the change queue, the DIF survey for an SME, the
 *  accreditation overview, a self-evaluation with evidence suggestions and maker-checker blockers, and the report generator with
 *  the "demo / not an accreditation decision" notice; in English and Arabic. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import SatPage from '../../src/modules/m26/SatPage';
import SatRolePage from '../../src/modules/m26/SatRolePage';
import SatTaskPage from '../../src/modules/m26/SatTaskPage';
import SatChangesPage from '../../src/modules/m26/SatChangesPage';
import DifSurveyPage from '../../src/modules/m26/DifSurveyPage';
import AccrPage, { useAccrModel } from '../../src/modules/m26/AccrPage';
import SelfEvalPage from '../../src/modules/m26/SelfEvalPage';
import AccrReportPage, { gapsCsv, serModel } from '../../src/modules/m26/AccrReportPage';
import { DEMO_NOTICE, RATINGS } from '../../src/modules/m26/accr';
import { RESTRICTED_TITLE } from '../../src/modules/m26/sat';
import seed from '../../src/seed/seed.json';

void useAccrModel; void RATINGS;
const T = { timeout: 20000 };
const S = (seed as unknown as { tables: Record<string, any[]> }).tables; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('F27 pages', () => {
  it('the workbench lists the analyses and lets anyone try the DIF rule', async () => {
    await renderPage(<SatPage />, { persona: 'training-mgr', path: '/training/sat' });
    const list = await screen.findByTestId('m26-analyses', {}, T);
    expect(within(list).getAllByTestId('m26-analysis-link').length).toBeGreaterThanOrEqual(13);
    expect(screen.getByTestId('m26-sat-tiles')).toBeTruthy();
    expect(screen.getByTestId('m26-rule-branches').textContent).toMatch(/overtrain|Overtrain/i);
    // the three security roles show as restricted cards only: the notice, no task titles and no link into the analysis
    expect(document.body.textContent!.split("Security, safeguards and cyber tasks are analysed and trained outside Kafa'a").length - 1).toBe(3);
    expect(within(list).getAllByTestId('m26-analysis-link').length).toBe(S.jta_analyses.filter((a) => !a.restricted).length);
    expect(document.body.textContent).not.toContain(RESTRICTED_TITLE.en);
  }, 30000);
  it('a staff member without SAT rights reads no analysis (the route guard also hides the page)', async () => {
    await renderPage(<SatPage />, { persona: 'k-ro', path: '/training/sat' });
    await new Promise((r) => setTimeout(r, 500));
    expect(screen.queryAllByTestId('m26-analysis-link').length).toBe(0);
  }, 30000);
  it('the matrix highlights every train-selected task without an objective', async () => {
    await renderPage(<SatRolePage />, { persona: 'k-auditor', path: '/training/sat/roles/local-operator', route: '/training/sat/roles/:roleId' });
    await screen.findByTestId('m26-role-header', {}, T);
    expect(screen.getByTestId('m26-inventory')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Training matrix/ }));
    const mx = await screen.findByTestId('m26-matrix');
    expect(within(mx).getAllByTestId('m26-gap').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId('m26-add-task')).toBeNull(); // the auditor reads only
  }, 30000);
  it('a restricted task shows only "restricted"', async () => {
    await renderPage(<SatTaskPage />, { persona: 'training-mgr', path: '/training/sat/tasks/jt-security-officer-r1', route: '/training/sat/tasks/:taskId' });
    expect((await screen.findAllByTestId('m26-restricted', {}, T)).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('m26-rate-form')).toBeNull();
    expect(screen.queryByTestId('m26-impact')).toBeNull();
  }, 30000);
  it('a task shows its DIF distribution, the decision with reasons and the impact of a change', async () => {
    await renderPage(<SatTaskPage />, { persona: 'training-mgr', path: '/training/sat/tasks/jt-qs-ro-t1', route: '/training/sat/tasks/:taskId' });
    expect(await screen.findByTestId('m26-dif-dist', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m26-decision')).toBeTruthy();
    expect(screen.getByTestId('m26-links')).toBeTruthy();
    expect(screen.getByTestId('m26-impact').textContent).toMatch(/qs-ro|QS-RO|Reactor/i);
  }, 30000);
  it('the change queue lists the open review items', async () => {
    await renderPage(<SatChangesPage />, { persona: 'k-instructor', path: '/training/sat/changes' });
    const q = await screen.findByTestId('m26-changes', {}, T);
    expect(within(q).getAllByTestId('m26-change-item').length).toBeGreaterThanOrEqual(3);
  }, 30000);
  it('the DIF survey opens for an SME of a role under survey', async () => {
    await renderPage(<DifSurveyPage />, { persona: 'sme-reviewer', path: '/training/sat/survey' });
    const sv = await screen.findByTestId('m26-survey', {}, T);
    expect(sv.textContent).toMatch(/Systems|plant/i);
  }, 30000);
  it('renders the workbench in Arabic', async () => {
    await renderPage(<SatPage />, { persona: 'training-mgr', path: '/ar/training/sat' });
    await screen.findByTestId('m26-analyses', {}, T);
    expect(document.body.textContent).toMatch(/منصة تحليل النهج المنهجي للتدريب/);
  }, 30000);
});

describe('F29 pages', () => {
  it('the overview lists programmes, gaps and the generic criteria', async () => {
    await renderPage(<AccrPage />, { persona: 'training-mgr', path: '/training/accreditation' });
    const p = await screen.findByTestId('m26-programmes', {}, T);
    expect(within(p).getAllByTestId('m26-selfeval-link').length).toBeGreaterThanOrEqual(6);
    expect(screen.getByTestId('m26-accr-tiles')).toBeTruthy();
    expect(document.body.textContent).toContain(DEMO_NOTICE.en);
  }, 30000);
  it('a sole-authored self-evaluation cannot be finalised by its author (maker-checker)', async () => {
    await renderPage(<SelfEvalPage />, { persona: 'training-mgr', path: '/training/accreditation/ase-chem-init-2026-H2', route: '/training/accreditation/:selfEvalId' });
    await screen.findAllByTestId('m26-se-criteria', {}, T);
    expect((screen.getByTestId('m26-finalise') as HTMLButtonElement).disabled).toBe(true);
    expect(document.body.textContent).toMatch(/only person who rated it/);
  }, 30000);
  it('a co-authored complete self-evaluation can be finalised; rating suggests evidence or says none was found', async () => {
    await renderPage(<SelfEvalPage />, { persona: 'training-mgr', path: '/training/accreditation/ase-coit-2026-H2', route: '/training/accreditation/:selfEvalId' });
    await screen.findAllByTestId('m26-se-criteria', {}, T);
    expect((screen.getByTestId('m26-finalise') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getAllByTestId('m26-rate-criterion')[0]);
    const sug = await screen.findByTestId('m26-suggestions');
    expect(sug.querySelectorAll('li').length).toBeGreaterThan(0);
  }, 30000);
  it('the report frame and the gap CSV carry the demo notice in both languages', async () => {
    await renderPage(<AccrReportPage />, { persona: 'k-auditor', path: '/training/accreditation/ase-coit-2026-H1/report', route: '/training/accreditation/:selfEvalId/report' });
    const fr = (await screen.findByTestId('m26-ser-frame', {}, T)) as HTMLIFrameElement;
    expect(fr.getAttribute('srcdoc')).toContain(DEMO_NOTICE.en);
    fireEvent.click(screen.getByTestId('m26-ser-ar'));
    expect(((await screen.findByTestId('m26-ser-frame')) as HTMLIFrameElement).getAttribute('srcdoc')).toContain(DEMO_NOTICE.ar);
    const d = { selfevals: S.accr_selfevals, programmes: S.accr_programmes, assessments: S.accr_assessments, criteria: S.accr_criteria } as never;
    const m = serModel(d, 'ase-loit-2026-H1', '2026-10-08');
    const csv = gapsCsv(m, 'en');
    expect(csv.split('\n')[0]).toContain(DEMO_NOTICE.en);
    expect(csv.split('\n')[0]).toContain(DEMO_NOTICE.ar);
    expect(csv.split('\n').length - 2).toBe(m.gaps);
  }, 30000);
  it('renders the accreditation overview in Arabic', async () => {
    await renderPage(<AccrPage />, { persona: 'training-mgr', path: '/ar/training/accreditation' });
    await screen.findByTestId('m26-programmes', {}, T);
    expect(document.body.textContent).toMatch(/الجاهزية للاعتماد/);
  }, 30000);
});
