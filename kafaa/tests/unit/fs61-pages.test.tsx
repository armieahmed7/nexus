// @vitest-environment jsdom
/** FS50 / FS51 pages (FS wave F · E1, M35) rendered with the real providers and the in-memory LocalBackend: the register board with
 *  computed progress, attention ranking and suppression; a register row with KPIs and the quarterly review (audit + ledger); the
 *  forecasting workbench with SIMULATED labels and a definitions link on every screen (FS51-1), a what-if and a reset that reproduces the
 *  baseline exactly (FS51-2), suppressed skills listed without numbers (FS51-3); the skill detail with Why this?; versions with the
 *  methodology-change block; the generations view; the method page. Every page shows its benchmark chips. */
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import seed from '../../src/seed/seed.json';
import en from '../../src/i18n/m35.en.json';
import ar from '../../src/i18n/m35.ar.json';
import CriticalSkillsPage from '../../src/modules/m35/CriticalSkillsPage';
import CriticalSkillPage from '../../src/modules/m35/CriticalSkillPage';
import SkillForecastsPage from '../../src/modules/m35/SkillForecastsPage';
import SkillForecastPage from '../../src/modules/m35/SkillForecastPage';
import ForecastVersionsPage from '../../src/modules/m35/ForecastVersionsPage';
import GenerationsPage from '../../src/modules/m35/GenerationsPage';
import ForecastMethodPage from '../../src/modules/m35/ForecastMethodPage';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const T = (seed as unknown as { tables: Record<string, Row[]> }).tables;
const W = { timeout: 30000 };
const chips = () => Array.from(document.querySelectorAll('button[data-testid^="benchmark-chip-"]')).map((x) => x.getAttribute('data-testid'));
const simLinks = () => screen.getAllByTestId('m35-definitions-link').map((a) => a.getAttribute('href') ?? '');

describe('FS50 pages', () => {
  it('HR director: the register board with tiles, computed progress (suppressed under 10), attention ranking and FS50 chips', async () => {
    await renderPage(<CriticalSkillsPage />, { persona: 'chco', path: '/workforce/critical-skills' });
    const cs = await screen.findByTestId('m35-cs', {}, { timeout: 90000 });
    expect(within(cs).getByTestId('m35-cs-tiles')).toBeTruthy();
    const reg = within(cs).getByTestId('m35-cs-register');
    await waitFor(() => expect(within(reg).getAllByTestId('m35-cs-link').length).toBeGreaterThanOrEqual(10), W);
    const statuses = within(reg).getAllByTestId('m35-progress-status').map((x) => x.getAttribute('data-status'));
    expect(statuses).toContain('suppressed');
    expect(statuses.some((x) => x === 'met' || x === 'on_track')).toBe(true);
    const att = within(cs).getAllByTestId('m35-cs-attention-item').map((x) => Number(x.getAttribute('data-score')));
    expect(att.length).toBeGreaterThan(0);
    expect([...att].sort((a, b) => b - a)).toEqual(att);
    expect(screen.getByTestId('m35-cs-add')).toBeTruthy();
    await waitFor(() => expect(chips()).toEqual(expect.arrayContaining(['benchmark-chip-IAEA-WFP', 'benchmark-chip-ISO30414', 'benchmark-chip-FORECAST'])), W);
  }, 150000);
  it('a register row: owner, decision with rationale, computed progress, KPIs; the HR director records the quarter review (audit + ledger)', async () => {
    const b = getLocalBackend();
    await renderPage(<CriticalSkillPage />, { persona: 'chco', path: '/workforce/critical-skills/cs-sk-hu-01', route: '/workforce/critical-skills/:id' });
    const d = await screen.findByTestId('m35-csd', {}, { timeout: 90000 });
    expect(d.getAttribute('data-id')).toBe('cs-sk-hu-01');
    expect(within(d).getByTestId('m35-csd-decision').textContent).toContain(T.critical_skills.find((r) => r.id === 'cs-sk-hu-01')!.rationale_en);
    expect(within(d).getByTestId('m35-csd-progress').getAttribute('data-status')).not.toBe('');
    expect(within(d).getByTestId('m35-csd-kpis').querySelectorAll('[data-kind]').length).toBeGreaterThan(0);
    const a0 = (b.raw('audit_events' as never) as unknown as Row[]).length, l0 = (b.raw('ledger_local' as never) as unknown as Row[]).length;
    const spy = vi.spyOn(b.rpc, 'reviewCriticalSkill');
    fireEvent.click(within(d).getByTestId('m35-csd-review'));
    const form = await screen.findByTestId('m35-csd-review-form', {}, W);
    expect(within(form).getByTestId('m35-csd-review-problem').getAttribute('data-problem')).toBeTruthy();
    fireEvent.change(within(form).getByLabelText(en.csd.noteEn), { target: { value: 'Quarter review: steady progress.' } });
    fireEvent.change(within(form).getByLabelText(en.csd.noteAr), { target: { value: 'مراجعة ربعية: تقدم ثابت.' } });
    await waitFor(() => expect(within(form).queryByTestId('m35-csd-review-problem')).toBeNull(), W);
    fireEvent.click(await screen.findByRole('button', { name: en.csd.saveReview }, W));
    await waitFor(() => expect(spy).toHaveBeenCalled(), W);
    expect((await spy.mock.results[0].value).ok).toBe(true);
    expect((b.raw('audit_events' as never) as unknown as Row[]).length).toBeGreaterThan(a0);
    expect((b.raw('ledger_local' as never) as unknown as Row[]).length).toBe(l0 + 1);
    spy.mockRestore();
  }, 150000);
  it('renders in Arabic', async () => {
    await renderPage(<CriticalSkillsPage />, { persona: 'chco', path: '/ar/workforce/critical-skills' });
    await screen.findByTestId('m35-cs', {}, { timeout: 90000 });
    expect(screen.getByText(ar.routes['workforce-critical-skills'].title, { selector: 'h1' })).toBeTruthy();
  }, 120000);
});

describe('FS51 pages', () => {
  it('training manager: every number SIMULATED with a definitions link; a what-if changes the band and reset reproduces the baseline exactly', async () => {
    const b = getLocalBackend();
    const spy = vi.spyOn(b.rpc, 'computeSkillForecast');
    await renderPage(<SkillForecastsPage />, { persona: 'training-mgr', path: '/workforce/skill-forecasts' });
    await screen.findByTestId('m35-fc-tiles', {}, { timeout: 90000 });
    expect(screen.getByTestId('m35-fc-baseline')).toBeTruthy();
    expect(screen.getAllByTestId('m35-sim-labels').length).toBeGreaterThan(0);
    expect(simLinks().some((h) => h.includes('/workforce/skill-forecasts/method#definitions'))).toBe(true);
    expect(screen.queryByTestId('m35-fc-save')).toBeNull();
    const tile0 = screen.getByTestId('m35-fc-tile-baseline').textContent;
    const supp = screen.getByTestId('m35-fc-suppressed');
    expect(supp.querySelectorAll('[data-suppressed="true"]').length).toBeGreaterThan(0);
    expect(supp.textContent!.replace(/<\s*10/g, '')).not.toMatch(/\d/);
    const slider = within(screen.getByTestId('m35-param-attrition_pct')).getByRole('slider');
    act(() => { fireEvent.change(slider, { target: { value: '9' } }); });
    await waitFor(() => expect(screen.queryByTestId('m35-fc-baseline')).toBeNull(), W);
    await waitFor(() => expect(screen.getByTestId('m35-fc-tile-baseline').textContent).not.toBe(tile0), W);
    fireEvent.click(screen.getByTestId('m35-fc-reset'));
    await waitFor(() => expect(screen.getByTestId('m35-fc-baseline')).toBeTruthy(), W);
    await waitFor(() => expect(screen.getByTestId('m35-fc-tile-baseline').textContent).toBe(tile0), W);
    const last = await spy.mock.results.at(-1)!.value;
    const first = await spy.mock.results[0].value;
    expect(last.data).toEqual(first.data);
    expect(first.data.simulated).toBe(true);
    spy.mockRestore();
    await waitFor(() => expect(chips()).toEqual(expect.arrayContaining(['benchmark-chip-IAEA-WFP', 'benchmark-chip-FORECAST', 'benchmark-chip-SMR-WF'])), W);
  }, 150000);
  it('a skill: the fan chart with three scenarios, the level mix and Why this?, SIMULATED', async () => {
    await renderPage(<SkillForecastPage />, { persona: 'k-hr-analyst', path: '/workforce/skill-forecasts/skills/sk-fs-ai-verify', route: '/workforce/skill-forecasts/skills/:skillId' });
    const d = await screen.findByTestId('m35-fcd', {}, { timeout: 90000 });
    expect(d.getAttribute('data-skill')).toBe('sk-fs-ai-verify');
    await waitFor(() => expect(screen.getAllByTestId('m35-fan-chart').length).toBeGreaterThan(0), W);
    expect(screen.getAllByTestId('m35-fan-chart')[0].querySelectorAll('[data-series]').length).toBeGreaterThanOrEqual(3);
    for (const sc of ['baseline', 'advance', 'accelerated']) expect(screen.getByTestId(`m35-fcd-why-${sc}`)).toBeTruthy();
    expect(screen.getAllByTestId('m35-level-mix').length).toBeGreaterThan(0);
    expect(simLinks().length).toBeGreaterThan(0);
  }, 150000);
  it('versions: the released 2026 cycle against the 2025 pilot is blocked by the methodology change; same-basis versions compare', async () => {
    await renderPage(<ForecastVersionsPage />, { persona: 'chco', path: '/workforce/skill-forecasts/versions' });
    const list = await screen.findByTestId('m35-ver-list', {}, { timeout: 90000 });
    await waitFor(() => expect(within(list).getAllByTestId('m35-ver-status').length).toBe(T.skill_forecasts.length), W);
    expect(within(list).getAllByTestId('m35-ver-release').length).toBe(T.skill_forecasts.filter((v) => v.status === 'draft').length);
    const blocked = screen.getByTestId('m35-ver-blocked');
    expect(blocked.getAttribute('data-blockers')).toMatch(/catalogue/);
    fireEvent.change(screen.getByTestId('m35-ver-pick-b'), { target: { value: 'sf-2026-v2' } });
    await waitFor(() => expect(screen.getByTestId('m35-ver-diff')).toBeTruthy(), W);
    expect(simLinks().length).toBeGreaterThan(0);
  }, 150000);
  it('generations: the plant-life windows to 2084 with the sourced licence fact', async () => {
    await renderPage(<GenerationsPage />, { persona: 'training-mgr', path: '/workforce/skill-forecasts/generations' });
    const g = await screen.findByTestId('m35-gen', {}, { timeout: 90000 });
    expect(within(g).getByTestId('m35-gen-life').textContent).toMatch(/2084/);
    expect(within(g).getByTestId('m35-gen-life').parentElement!.querySelector('a[href^="https://"]')).toBeTruthy();
    expect(simLinks().length).toBeGreaterThan(0);
  }, 150000);
  it('the method page holds the definitions, assumptions and the not-modelled list (EN and AR)', async () => {
    await renderPage(<ForecastMethodPage />, { persona: 'k-auditor', path: '/workforce/skill-forecasts/method' });
    const m = await screen.findByTestId('m35-method', {}, { timeout: 90000 });
    expect(m.querySelector('#definitions')).toBeTruthy();
    expect(within(m).getByTestId('m35-met-terms').textContent).toContain(en.def.simulated.term);
    expect(m.querySelector('#not-modelled')).toBeTruthy();
  }, 150000);
  it('the method page renders in Arabic', async () => {
    await renderPage(<ForecastMethodPage />, { persona: 'k-auditor', path: '/ar/workforce/skill-forecasts/method' });
    await screen.findByTestId('m35-method', {}, { timeout: 90000 });
    expect(screen.getByText(ar.routes['workforce-skill-forecast-method'].title, { selector: 'h1' })).toBeTruthy();
  }, 150000);
});
