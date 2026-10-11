// @vitest-environment jsdom
/** FS21 / FS22 pages (FS wave C · E3): my adaptive banks, taking a safety-related bank to its result (no percentile), a performance
 * task with its rubric published before the attempt, the assessor queue, integrity reports for assessors and auditors, and the
 * training-staff bank view, in English and Arabic. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import AdaptivePage from '../../src/modules/m05/AdaptivePage';
import AdaptiveTakePage from '../../src/modules/m05/AdaptiveTakePage';
import PerfTasksPage from '../../src/modules/m05/PerfTasksPage';
import PerfTaskPage from '../../src/modules/m05/PerfTaskPage';
import TrainingAdaptivePage from '../../src/modules/m05/TrainingAdaptivePage';
import TrainingPerfTasksPage from '../../src/modules/m05/TrainingPerfTasksPage';
import IntegrityPage from '../../src/modules/m05/IntegrityPage';
import en from '../../src/i18n/m05.en.json';
import ar from '../../src/i18n/m05.ar.json';

const T = { timeout: 20000 };
const chips = (root: HTMLElement) => Array.from(root.querySelectorAll('button[data-testid^="benchmark-chip-"]')).map((x) => x.getAttribute('data-testid'));

describe('/my/assessments/adaptive (FS21)', () => {
  it('k-ro sees six banks with their mode; safety-related banks never show a percentile; FS21 benchmarks', async () => {
    const { container } = await renderPage(<AdaptivePage />, { path: '/my/assessments/adaptive', persona: 'k-ro' });
    const list = await screen.findByTestId('m05-ad-banks', {}, T);
    for (const id of ['ab-ai-literacy', 'ab-plant-data', 'ab-digital-twins', 'ab-cyber-hygiene', 'ab-smr', 'ab-clean-energy']) expect(within(list).getByTestId(`m05-ad-bank-${id}`)).toBeTruthy();
    for (const id of ['ab-cyber-hygiene', 'ab-smr']) {
      const card = within(list).getByTestId(`m05-ad-bank-${id}`);
      expect(card.textContent).toContain(en.ad.mode.safety);
      expect(card.textContent).not.toMatch(/Higher than \d+% of/);
    }
    // k-ro took AI literacy twice: the latest result is a percentile against colleagues (developmental)
    expect(within(list).getByTestId('m05-ad-bank-ab-ai-literacy').textContent).toMatch(/Higher than \d+% of colleagues|No comparison yet/);
    await waitFor(() => expect(chips(container)).toEqual(expect.arrayContaining(['benchmark-chip-SKILLS-TECH', 'benchmark-chip-OECD-PIAAC'])), T);
  });

  it('renders in Arabic', async () => {
    await renderPage(<AdaptivePage />, { path: '/ar/my/assessments/adaptive', persona: 'k-ro' });
    await screen.findByTestId('m05-ad-banks', {}, T);
    expect(screen.getByText(ar.routes['my-adaptive'].title)).toBeTruthy();
    expect(screen.getAllByText(ar.ad.mode.safety).length).toBeGreaterThan(0);
  });
});

describe('/my/assessments/adaptive/:bank (FS21)', () => {
  it('buyer takes the cyber hygiene bank to a criterion result: meets or not, never a percentile, with reasons and evidence', async () => {
    await renderPage(<AdaptiveTakePage />, { path: '/my/assessments/adaptive/ab-cyber-hygiene', route: '/my/assessments/adaptive/:bank', persona: 'buyer' });
    const rules = await screen.findByTestId('m05-take-rules', {}, T);
    expect(rules.textContent).toContain('never a percentile');
    fireEvent.click(screen.getByTestId('m05-take-start'));
    for (let k = 0; k < 21; k++) {
      const q = await screen.findByTestId('m05-take-question', {}, T).catch(() => null);
      if (!q || screen.queryByTestId('m05-take-result')) break;
      const item = q.getAttribute('data-item');
      fireEvent.click(within(q).getByTestId('m05-take-opt-0'));
      fireEvent.click(within(q).getByTestId('m05-take-next'));
      await waitFor(() => expect(screen.queryByTestId('m05-take-result') || screen.getByTestId('m05-take-question').getAttribute('data-item') !== item).toBeTruthy(), T);
      if (screen.queryByTestId('m05-take-result')) break;
    }
    const res = await screen.findByTestId('m05-take-result', {}, T);
    expect(res.getAttribute('data-criterion')).toBe('yes');
    expect(res.getAttribute('data-percentile')).toBe('');
    expect(screen.getByTestId('m05-take-no-pct').textContent).toBe(en.take.res.criterionNote);
    expect(document.body.textContent).not.toMatch(/Higher than \d+% of/);
  }, 120000);
});

describe('/my/assessments/tasks (FS22)', () => {
  it('lists the simulated tasks with status and the credential they count towards', async () => {
    const { container } = await renderPage(<PerfTasksPage />, { path: '/my/assessments/tasks', persona: 'k-ro' });
    const list = await screen.findByTestId('m05-pt-list', {}, T);
    expect(within(list).getAllByText(en.pt.simulated).length).toBe(4);
    expect(within(list).getByTestId('m05-pt-card-pt-ai-alert').textContent).toContain(en.pt.status.submitted);
    await waitFor(() => expect(chips(container)).toEqual(expect.arrayContaining(['benchmark-chip-SKILLS-TECH', 'benchmark-chip-IAEA-AI'])), T);
  });

  it('every rubric line is visible before the attempt, and the task starts only after the rubric is confirmed', async () => {
    await renderPage(<PerfTaskPage />, { path: '/my/assessments/tasks/pt-twin-divergence', route: '/my/assessments/tasks/:task', persona: 'buyer' });
    const box = await screen.findByTestId('m05-pt-start-box', {}, T);
    for (const k of ['anomaly', 'quality', 'decision', 'justify']) expect(screen.getByTestId(`m05-rubric-line-${k}`)).toBeTruthy();
    expect(screen.getByTestId('m05-rubric-pass')).toBeTruthy();
    expect(screen.queryByTestId('m05-pt-submit')).toBeNull();
    const start = within(box).getByTestId('m05-pt-start') as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    fireEvent.click(within(box).getByLabelText(en.pt.rubricSeen));
    expect(start.disabled).toBe(false);
    fireEvent.click(start);
    await screen.findByTestId('m05-pt-submit', {}, T);
    expect(screen.getByTestId('m05-pt-mark')).toBeTruthy();
    expect(document.body.textContent).toContain(en.pt.noPlant);
  });

  it('renders in Arabic with the rubric first', async () => {
    await renderPage(<PerfTaskPage />, { path: '/ar/my/assessments/tasks/pt-feedwater-drift', route: '/ar/my/assessments/tasks/:task', persona: 'buyer' });
    await screen.findByTestId('m05-pt-start-box', {}, T);
    expect(screen.getByText(ar.pt.rubricTitle)).toBeTruthy();
    expect(screen.getByLabelText(ar.pt.rubricSeen)).toBeTruthy();
  });
});

describe('/training/perf-tasks (FS22 assessors)', () => {
  it('the instructor sees the queue, opens an attempt with the key window and the rubric, and must score every assessor line', async () => {
    await renderPage(<TrainingPerfTasksPage />, { path: '/training/perf-tasks', persona: 'k-instructor' });
    const queue = await screen.findByTestId('m05-as-queue', {}, T);
    const open = queue.querySelector('button[data-testid^="m05-as-open-"]') as HTMLButtonElement;
    fireEvent.click(open);
    const drawer = await screen.findByTestId('m05-as-drawer', {}, T);
    expect(drawer.textContent).toContain(en.as.keyNote);
    expect((screen.getByTestId('m05-as-submit') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('/training/integrity (FS22)', () => {
  it('auditors read every report (read-only) and see no decision buttons', async () => {
    await renderPage(<IntegrityPage />, { path: '/training/integrity', persona: 'k-auditor' });
    await screen.findByText(en.ir.readOnly, {}, T);
    fireEvent.click(screen.getByTestId('m05-ir-filter-all'));
    const table = await screen.findByTestId('m05-ir-table', {}, T);
    fireEvent.click(table.querySelector('button[data-testid^="m05-ir-open-"]') as HTMLButtonElement);
    await screen.findByTestId('m05-ir-drawer', {}, T);
    expect(screen.queryByTestId('m05-ir-accept')).toBeNull();
    expect(screen.queryByTestId('m05-ir-void')).toBeNull();
  });

  it('an assessor sees flagged reports to review with accept and void', async () => {
    await renderPage(<IntegrityPage />, { path: '/training/integrity', persona: 'k-instructor' });
    const table = await screen.findByTestId('m05-ir-table', {}, T);
    const btns = Array.from(table.querySelectorAll('button[data-testid^="m05-ir-open-"]')) as HTMLButtonElement[];
    expect(btns.length).toBeGreaterThan(0);
    fireEvent.click(btns.find((x) => !x.getAttribute('data-testid')!.includes('k-instructor'))!);
    await screen.findByTestId('m05-ir-drawer', {}, T);
    expect(screen.getByTestId('m05-ir-accept')).toBeTruthy();
    expect(screen.getByTestId('m05-ir-void')).toBeTruthy();
  });

  it('renders in Arabic', async () => {
    await renderPage(<IntegrityPage />, { path: '/ar/training/integrity', persona: 'k-auditor' });
    await screen.findByText(ar.ir.readOnly, {}, T);
    expect(screen.getByText(ar.ir.flagsTitle)).toBeTruthy();
  });
});

describe('/training/adaptive (FS21 training staff)', () => {
  it('the training manager sees per-bank results with the OECD reference line and can add items', async () => {
    const { container } = await renderPage(<TrainingAdaptivePage />, { path: '/training/adaptive', persona: 'training-mgr' });
    const res = await screen.findByTestId('m05-tr-results', {}, T);
    expect(res.querySelectorAll('[data-testid^="m05-tr-bank-"]').length).toBe(6);
    expect(res.textContent).toContain(en.tr.criterionNote);
    await waitFor(() => expect(chips(container)).toEqual(expect.arrayContaining(['benchmark-chip-OECD-PIAAC'])), T);
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(en.tr.tab.items) }));
    expect(await screen.findByTestId('m05-tr-add', {}, T)).toBeTruthy();
  });
});
