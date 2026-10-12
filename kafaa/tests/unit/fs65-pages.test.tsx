// @vitest-environment jsdom
/** FS58/FS59 pages rendered with the real providers and the in-memory LocalBackend: adaptive problem-solving end to end (the plan
 *  without the key, the expert key and debrief, the mid-task change revealed after the plan, the result with the benchmark line and the
 *  scale definition, EN and AR); the scenario bank (read-only for instructors, editable for the training manager); the role-play library
 *  with each rubric in EN and AR; a role-play session (ticks per answer, the box clears, a speak-up topic routes to /speak-up without any
 *  request); my feedback history and asking a named reviewer; the reviewer's queue and validation; the HR aggregate. Every page shows
 *  its chips. */
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import seed from '../../src/seed/seed.json';
import ProblemSolvingPage from '../../src/modules/m33/ProblemSolvingPage';
import ApsScenariosPage from '../../src/modules/m33/ApsScenariosPage';
import RolePlayLibraryPage from '../../src/modules/m33/RolePlayLibraryPage';
import RolePlaySessionPage from '../../src/modules/m33/RolePlaySessionPage';
import MyRolePlayPage from '../../src/modules/m33/MyRolePlayPage';
import TrainingRolePlayPage from '../../src/modules/m33/TrainingRolePlayPage';
import WorkforcePracticePage from '../../src/modules/m33/WorkforcePracticePage';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const TB = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const T = { timeout: 30000 };

describe('FS58 pages', () => {
  it('problem-solving practice end to end: plan without the key, key and debrief, the change after the plan, result with the benchmark line and the scale', async () => {
    await renderPage(<ProblemSolvingPage />, { persona: 'k-lo-trainee', path: '/my/core-skills/problem-solving' });
    const cards = await screen.findAllByTestId('m33-aps-scenario', {}, { timeout: 90000 });
    expect(cards.length).toBe(6);
    expect(cards.every((c) => Number(c.getAttribute('data-changes')) >= 1)).toBe(true);
    expect(screen.getByTestId('m33-aps-scale')).toBeTruthy();
    expect(screen.getByTestId('m33-aps-next')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByTestId('benchmark-chip-OECD-PIAAC')[0].tagName).toBe('BUTTON'), T);
    const sc = TB.aps_scenarios.find((x) => x.id === 'aps-os-001')!;
    fireEvent.click(within(cards.find((c) => c.getAttribute('data-id') === 'aps-os-001')!).getByTestId('m33-aps-start'));
    for (let i = 0; i < sc.stages.length; i++) {
      const stage = await screen.findByTestId('m33-aps-stage', {}, T);
      expect(stage.getAttribute('data-stage')).toBe(sc.stages[i].id);
      expect(stage.getAttribute('data-kind')).toBe(i === 0 ? 'initial' : 'change');
      if (i > 0) expect(screen.getByTestId('m33-aps-change')).toBeTruthy();
      else expect(document.body.textContent).not.toContain(sc.stages[1].info_en);
      expect(screen.queryByTestId('m33-aps-key')).toBeNull();
      const best = (sc.stages[i].options as Row[]).findIndex((o) => o.eff === 3);
      (sc.stages[i].cues ?? []).forEach((c: Row, k: number) => { if (c.relevant) fireEvent.click(screen.getByTestId(`m33-aps-cue-${k}`)); });
      fireEvent.click(screen.getByTestId(`m33-aps-opt-${best}`));
      fireEvent.click(screen.getByTestId('m33-aps-submit'));
      expect(await screen.findByTestId('m33-aps-key', {}, T)).toBeTruthy();
      expect(screen.getByTestId('m33-aps-verdict').getAttribute('data-verdict')).toBe('3');
      expect(screen.getByTestId('m33-aps-debrief').textContent).toContain(sc.stages[i].debrief_en);
      fireEvent.click(screen.getByTestId('m33-aps-continue'));
    }
    const res = await screen.findByTestId('m33-aps-result', {}, T);
    expect(res.getAttribute('data-score')).toBe('100');
    expect(res.getAttribute('data-band')).toBe('strategic');
    expect(within(screen.getByTestId('m33-aps-line')).getByTestId('benchmark-line')).toBeTruthy();
    expect(screen.getByTestId('m33-aps-result-piaac')).toBeTruthy();
    expect(screen.getByTestId('m33-aps-scale').querySelector('[data-band="strategic"]')!.getAttribute('data-on')).toBe('yes');
    fireEvent.click(screen.getByTestId('m33-aps-why'));
    expect((await screen.findByTestId('m33-aps-why-panel')).textContent).toMatch(/practice scale|never a qualification/i);
    expect(screen.getByTestId('m33-aps-dims').querySelectorAll('li').length).toBe(3);
  }, 200000);
  it('renders in Arabic with the scale definition and the PIAAC context note', async () => {
    await renderPage(<ProblemSolvingPage />, { persona: 'nse', path: '/ar/my/core-skills/problem-solving' });
    expect((await screen.findAllByTestId('m33-aps-scenario', {}, T)).length).toBe(6);
    expect(document.body.textContent).toContain('مقياس التمرين');
    expect(document.body.textContent).toContain('لا تُحوَّل درجة تمرينك إليه أبداً');
    expect(screen.getByTestId('m33-aps-start-next').textContent).toBe('تابع'); // the demo NSE has a run open
  }, 60000);
  it('the scenario bank: instructors read, the training manager edits through the checked editor', async () => {
    await renderPage(<ApsScenariosPage />, { persona: 'k-instructor', path: '/training/aps/scenarios' });
    expect(await screen.findByTestId('m33-aps-bank-readonly', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m33-aps-bank-list').querySelectorAll('tbody tr').length).toBe(7);
    expect(screen.getAllByTestId('m33-aps-bank-changes').every((x) => Number(x.getAttribute('data-n')) >= 1)).toBe(true);
    cleanup();
    await renderPage(<ApsScenariosPage />, { persona: 'training-mgr', path: '/training/aps/scenarios' });
    fireEvent.click(await screen.findByTestId('m33-aps-bank-add', {}, T));
    const json = await screen.findByTestId('m33-aps-editor-json');
    const body = JSON.parse((json as HTMLTextAreaElement).value);
    fireEvent.change(json, { target: { value: JSON.stringify({ ...body, code: 'APS-ZZ-001', stages: body.stages.map((s: Row) => ({ ...s, kind: 'initial' })) }) } });
    expect(screen.getByTestId('m33-aps-editor-problem').textContent).toMatch(/mid-task change/);
    fireEvent.change(json, { target: { value: JSON.stringify({ ...body, code: 'APS-ZZ-001' }) } });
    expect(screen.queryByTestId('m33-aps-editor-problem')).toBeNull();
    fireEvent.click(screen.getByTestId('m33-aps-editor-save'));
    await waitFor(() => expect(screen.getByTestId('m33-aps-bank-list').querySelectorAll('tbody tr').length).toBe(8), T);
  }, 90000);
});

describe('FS59 pages', () => {
  it('the library: six published scenarios; each rubric in English and Arabic', async () => {
    await renderPage(<RolePlayLibraryPage />, { persona: 'nse', path: '/learn/role-play' });
    const cards = await screen.findAllByTestId('m33-rp-scenario', {}, T);
    expect(cards.length).toBe(6);
    await waitFor(() => expect(screen.getAllByTestId('benchmark-chip-SKILLS-TECH')[0].tagName).toBe('BUTTON'), T);
    fireEvent.click(within(cards[0]).getByTestId('m33-rp-open-rubric'));
    const enB = await screen.findByTestId('m33-rp-rubric-en');
    const arB = screen.getByTestId('m33-rp-rubric-ar');
    expect(arB.getAttribute('dir')).toBe('rtl');
    const sc = TB.roleplay_scenarios.find((x) => x.id === cards[0].getAttribute('data-id'))!;
    expect(enB.querySelectorAll('[data-criterion]').length).toBe(sc.rubric.length);
    expect(arB.textContent).toContain(sc.rubric[0].label_ar);
    expect(enB.textContent).toContain(sc.rubric[0].label_en);
  }, 60000);
  it('a session: ticks per answer and the box clears; a speak-up topic routes to /speak-up and sends nothing', async () => {
    let spy: { mock: { calls: unknown[] } } | null = null;
    await renderPage(<RolePlaySessionPage />, { persona: 'qc-inspector', path: '/my/role-play/rp-st-01', route: '/my/role-play/:id', prepare: (b) => { spy = vi.spyOn(b.rpc, 'roleplayTurn'); } });
    fireEvent.click(await screen.findByTestId('m33-rp-start', {}, T));
    const sc = TB.roleplay_scenarios.find((x) => x.id === 'rp-st-01')!;
    const box = (await screen.findByTestId('m33-rp-answer', {}, T)) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: 'Honestly, I want to report that my supervisor told me to falsify the turnover log.' } });
    fireEvent.click(screen.getByTestId('m33-rp-submit'));
    expect(await screen.findByTestId('m33-rp-speakup')).toBeTruthy();
    expect(screen.getByTestId('m33-rp-speakup-link').getAttribute('href')).toMatch(/\/speak-up$/);
    expect(spy!.mock.calls.length).toBe(0);
    expect(box.value).toBe('');
    expect(JSON.stringify(getLocalBackend().raw('roleplay_sessions' as never))).not.toContain('falsify the turnover');
    for (let i = 0; i < sc.turns.length; i++) {
      const turn = await screen.findByTestId('m33-rp-turn', {}, T);
      expect(turn.getAttribute('data-turn')).toBe(sc.turns[i].id);
      fireEvent.change(screen.getByTestId('m33-rp-answer'), { target: { value: sc.turns[i].example_en } });
      fireEvent.click(screen.getByTestId('m33-rp-submit'));
      const fb = await screen.findByTestId('m33-rp-feedback', {}, T);
      expect(fb.getAttribute('data-passed')).toBe(fb.getAttribute('data-total'));
      expect(screen.getAllByTestId('m33-rp-tick').every((x) => x.getAttribute('data-pass') === 'yes')).toBe(true);
      fireEvent.click(screen.getByTestId('m33-rp-continue'));
    }
    expect(spy!.mock.calls.length).toBe(sc.turns.length);
    const res = await screen.findByTestId('m33-rp-result', {}, T);
    expect(res.getAttribute('data-ready')).toBe('yes');
    expect(screen.getByTestId('m33-rp-to-review').getAttribute('href')).toMatch(/tab=history&review=/);
    expect(JSON.stringify(getLocalBackend().raw('roleplay_sessions' as never))).not.toContain(sc.turns[0].example_en);
  }, 120000);
  it('my feedback history (k-ro): two sessions, ticks without words, ask a named reviewer, then withdraw', async () => {
    await renderPage(<MyRolePlayPage />, { persona: 'k-ro', path: '/my/role-play?tab=history' });
    const hist = await screen.findByTestId('m33-rp-history', {}, T);
    expect(hist.querySelectorAll('tbody tr').length).toBe(2);
    fireEvent.click(within(hist).getByTestId('m33-rp-ask'));
    await screen.findByTestId('m33-rp-ask-form');
    fireEvent.change(screen.getByLabelText(/Reviewer/), { target: { value: 'p-k-instructor' } });
    fireEvent.change(screen.getByLabelText(/Practice context/), { target: { value: 'Before my next pre-job brief on the outage' } });
    fireEvent.click(screen.getByTestId('m33-rp-ask-send'));
    await waitFor(() => expect(screen.getAllByTestId('m33-rp-review').some((x) => x.getAttribute('data-status') === 'requested')).toBe(true), T);
    fireEvent.click(await screen.findByTestId('m33-rp-withdraw'));
    fireEvent.click(await screen.findByTestId('confirm-action'));
    await waitFor(() => expect(screen.getAllByTestId('m33-rp-review').some((x) => x.getAttribute('data-status') === 'withdrawn')).toBe(true), T);
  }, 90000);
  it('the reviewer (training manager): the session sent by name with ticks, rubric and context; validate writes the evidence', async () => {
    await renderPage(<TrainingRolePlayPage />, { persona: 'training-mgr', path: '/training/role-play' });
    const item = (await screen.findAllByTestId('m33-rp-queue-item', {}, T)).find((x) => x.getAttribute('data-id') === 'rp-s-0003')!;
    expect(within(item).getByTestId('m33-rp-queue-context')).toBeTruthy();
    expect(within(item).getByTestId('m33-rp-queue-rubric')).toBeTruthy();
    fireEvent.click(within(item).getByTestId('m33-rp-validate'));
    fireEvent.click(await screen.findByTestId('confirm-action'));
    await waitFor(() => expect(screen.queryAllByTestId('m33-rp-queue-item').some((x) => x.getAttribute('data-id') === 'rp-s-0003')).toBe(false), T);
    const ev = (getLocalBackend().raw('skill_evidence' as never) as Row[]).filter((e) => e.ref_table === 'roleplay_sessions' && e.ref_id === 'rp-s-0003');
    expect(ev.length).toBeGreaterThan(0);
    expect(ev.every((e) => e.kind === 'rating' && e.basis === 'validated')).toBe(true);
    fireEvent.click(screen.getAllByRole('tab')[1]);
    expect((await screen.findByTestId('m33-rp-admin-list', {}, T)).querySelectorAll('tbody tr').length).toBe(7);
    expect(screen.getByTestId('m33-rp-add')).toBeTruthy();
  }, 90000);
  it('HR sees practice in aggregate only, suppressed under 10, with both features chips', async () => {
    await renderPage(<WorkforcePracticePage />, { persona: 'chco', path: '/workforce/core-skills/practice' });
    expect(await screen.findByTestId('m33-wp-aps-tiles', {}, T)).toBeTruthy();
    expect(screen.getByTestId('m33-wp-rp-tiles')).toBeTruthy();
    expect(screen.getByTestId('m33-wp-bands').querySelectorAll('li').length).toBe(4);
    expect(document.body.textContent).not.toMatch(/p-k-ro|p-nse/);
    await waitFor(() => { expect(screen.getAllByTestId('benchmark-chip-OECD-PIAAC').length).toBeGreaterThan(0); expect(screen.getAllByTestId('benchmark-chip-SKILLS-TECH').length).toBeGreaterThan(0); }, T);
  }, 60000);
});
