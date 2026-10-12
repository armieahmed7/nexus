// @vitest-environment jsdom
/**
 * FS54 / FS55 pages (wave F · E3, M16), rendered with the real providers and the in-memory LocalBackend (g1-harness):
 * the public change log, proposing a change, the council queue (maker-checker in the UI), catalogue health with drill-downs,
 * the generated datasheet, the model-risk template and the two new AI-transparency tabs. EN and AR.
 */
import { describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 120000 }); // seed boot about 27 s per render
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import seed from '../../src/seed/seed.json';
import SkillChangesPage from '../../src/modules/m16/SkillChangesPage';
import ProposeSkillChangePage from '../../src/modules/m16/ProposeSkillChangePage';
import SkillsCouncilPage from '../../src/modules/m16/SkillsCouncilPage';
import SkillsHealthPage from '../../src/modules/m16/SkillsHealthPage';
import DatasheetPage from '../../src/modules/m16/DatasheetPage';
import ModelRiskPage from '../../src/modules/m16/ModelRiskPage';
import AiTransparencyPage from '../../src/modules/m16/AiTransparencyPage';
import { RANKED_SURFACES, SURFACE_METRICS } from '../../src/modules/m16/surfaces';

const S = seed as unknown as { tables: Record<string, any[]> };
const W = { timeout: 30000 };
const field = (name: string) => document.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

describe('FS54 /skills/changes (public change log)', () => {
  it('anonymous visitors read the published changes with tiles, a methodology flag and the before/after detail', async () => {
    await renderPage(<SkillChangesPage />, { persona: null, path: '/skills/changes' });
    const log = await screen.findByTestId('m16-change-log', {}, W);
    expect(screen.getByTestId('m16-log-tiles')).toBeTruthy();
    expect(within(log).getAllByTestId('m16-change').length).toBeGreaterThan(5);
    expect(within(log).getAllByTestId('m16-change-methodology').length).toBeGreaterThan(0);
    expect(screen.getByTestId('m16-log-how')).toBeTruthy();
    fireEvent.change(screen.getByTestId('m16-log-kind'), { target: { value: 'retire' } });
    await waitFor(() => expect(within(screen.getByTestId('m16-change-log')).getAllByTestId('m16-change').every((c) => c.getAttribute('data-kind') === 'retire')).toBe(true), W);
    const retire = within(screen.getByTestId('m16-change-log')).getAllByTestId('m16-change')[0];
    fireEvent.click(within(retire).getByTestId('m16-change-toggle'));
    const detail = await within(retire).findByTestId('m16-change-detail', {}, W);
    expect(detail.textContent).toMatch(/Lifecycle/);
    expect(detail.textContent).toMatch(/Obsolete/);
    expect(screen.queryByTestId('m16-log-propose')).toBeNull(); // proposing needs a staff sign-in
  });
  it('renders in Arabic', async () => {
    await renderPage(<SkillChangesPage />, { persona: null, path: '/ar/skills/changes' });
    await screen.findByTestId('m16-change-log', {}, W);
    expect(document.body.textContent).toMatch(/كيف يبقى الكتالوج محدَّثاً/);
  });
});

describe('FS54 /skills/changes/propose', () => {
  it('an employee proposes retiring a skill: the inclusion rule is checked live and the confirmed request reaches the council', async () => {
    const b = getLocalBackend();
    await b.whenReady();
    const open = new Set(S.tables.skill_change_requests.filter((r) => ['submitted', 'first_approved', 'first_rejected'].includes(r.status)).map((r) => r.skill_id));
    const sk = S.tables.skills.find((s) => s.lifecycle !== 'obsolete' && !open.has(s.id))!;
    await renderPage(<ProposeSkillChangePage />, { persona: 'k-ro', path: `/skills/changes/propose?skill=${sk.id}&kind=retire` });
    await screen.findByTestId('m16-propose-form', {}, W);
    expect((await screen.findByTestId('m16-propose-target', {}, W)).textContent).toBeTruthy();
    expect((screen.getByTestId('m16-propose-submit') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(field('development'), { target: { value: 'Developed by the paper-to-electronic transition course only.' } });
    fireEvent.change(field('assessment'), { target: { value: 'Assessed by an observed work-package walk-through.' } });
    fireEvent.change(field('rationale'), { target: { value: 'Superseded by electronic work packages.' } });
    await waitFor(() => expect(screen.getAllByTestId('m16-inclusion')[0].getAttribute('data-ok')).toBe('true'), W);
    expect(screen.getByTestId('m16-propose-title').textContent).toMatch(/Retire/);
    fireEvent.click(screen.getByTestId('m16-propose-submit'));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
    await waitFor(() => expect(getLocalBackend().raw('skill_change_requests').some((r) => r.skill_id === sk.id && r.kind === 'retire' && r.proposed_by === 'p-k-ro' && r.status === 'submitted')).toBe(true), W);
    const id = getLocalBackend().raw('skill_change_requests').find((r) => r.skill_id === sk.id && r.proposed_by === 'p-k-ro')!.id;
    await waitFor(() => expect(screen.getByTestId('m16-my-requests').querySelector(`[data-id="${id}"]`)?.textContent).toMatch(/Waiting for the first council vote/), W);
  });
  it('a too-short development statement keeps the request from being sent', async () => {
    await renderPage(<ProposeSkillChangePage />, { persona: 'k-ro', path: '/skills/changes/propose?kind=add' });
    await screen.findByTestId('m16-propose-form', {}, W);
    fireEvent.change(field('development'), { target: { value: 'short' } });
    expect((screen.getByTestId('m16-propose-submit') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByTestId('m16-inclusion')[0].getAttribute('data-ok')).toBe('false');
  });
});

describe('FS54 /admin/skills-council (maker-checker)', () => {
  it('the proposer of a request cannot vote on it; a different member publishes it and the skill becomes obsolete', async () => {
    await renderPage(<SkillsCouncilPage />, { persona: 'training-mgr', path: '/admin/skills-council' });
    const list = await screen.findByTestId('m16-council-list', {}, W);
    const own = within(list).getAllByTestId('m16-request').find((r) => r.getAttribute('data-id') === 'scr-053')!;
    expect(within(own).getByTestId('m16-request-blocked').textContent).toMatch(/you proposed this change/);
    expect((within(own).getByTestId('m16-request-approve') as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    await renderPage(<SkillsCouncilPage />, { persona: 'k-admin', path: '/admin/skills-council' });
    const list2 = await screen.findByTestId('m16-council-list', {}, W);
    const req = within(list2).getAllByTestId('m16-request').find((r) => r.getAttribute('data-id') === 'scr-053')!;
    expect(within(req).getByTestId('m16-request-plan')).toBeTruthy();
    fireEvent.click(within(req).getByTestId('m16-request-approve'));
    fireEvent.click(await screen.findByTestId('confirm-action', {}, W));
    await waitFor(() => expect(getLocalBackend().rawGet('skill_change_requests', 'scr-053')?.status).toBe('published'), W);
    expect(getLocalBackend().rawGet('skills', 'sk-fs-dp-paperlog')).toMatchObject({ lifecycle: 'obsolete', replaced_by: 'sk-fs-dp-rounds' });
  });
  it('a rejection needs a reason; the auditor reads the queue without voting; an employee has no access', async () => {
    await renderPage(<SkillsCouncilPage />, { persona: 'chco', path: '/admin/skills-council' });
    const req = within(await screen.findByTestId('m16-council-list', {}, W)).getAllByTestId('m16-request').find((r) => r.getAttribute('data-id') === 'scr-051')!;
    fireEvent.click(within(req).getByTestId('m16-request-reject'));
    const ok = await screen.findByTestId('confirm-action', {}, W);
    expect((ok as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('m16-request-note'), { target: { value: 'The new name collides with an alternative label.' } });
    await waitFor(() => expect((screen.getByTestId('confirm-action') as HTMLButtonElement).disabled).toBe(false), W);
    cleanup();
    await renderPage(<SkillsCouncilPage />, { persona: 'k-auditor', path: '/admin/skills-council' });
    await screen.findByTestId('m16-council-list', {}, W);
    expect(screen.queryAllByTestId('m16-request-approve')).toHaveLength(0);
    cleanup();
    await renderPage(<SkillsCouncilPage />, { persona: 'k-ro', path: '/admin/skills-council' });
    await waitFor(() => expect(document.body.textContent).toMatch(/open to skills council members and auditors/), W);
  });
});

describe('FS54 /admin/skills-health (staleness and orphan audit)', () => {
  it('tiles and drill-down filters: each chip opens the list of its skills', async () => {
    await renderPage(<SkillsHealthPage />, { persona: 'chco', path: '/admin/skills-health' });
    const tiles = await screen.findByTestId('m16-health-tiles', {}, W);
    expect(within(tiles).getAllByText(/./).length).toBeGreaterThan(5);
    const chips = screen.getByTestId('m16-health-filters');
    const untaught = within(chips).getAllByRole('tab').find((c) => c.getAttribute('data-filter') === 'untaught')!;
    expect(Number(untaught.getAttribute('data-n'))).toBeGreaterThan(0);
    fireEvent.click(untaught);
    await waitFor(() => expect(screen.getByTestId('m16-health-table').getAttribute('data-filter')).toBe('untaught'), W);
    expect(within(screen.getByTestId('m16-health-table')).getAllByRole('row').length).toBeGreaterThan(1);
    expect(screen.getByTestId('m16-taught-by')).toBeTruthy();
  });
});

describe('FS55 /skills/datasheet (generated from the catalogue)', () => {
  it('shows the catalogue size computed from the data and all six sections', async () => {
    await renderPage(<DatasheetPage />, { persona: null, path: '/skills/datasheet' });
    const ds = await screen.findByTestId('m16-datasheet', {}, W);
    expect(Number(ds.getAttribute('data-skills'))).toBe(getLocalBackend().raw('skills').length);
    for (let i = 1; i <= 6; i++) expect(screen.getByTestId(`m16-ds-section-${i}`)).toBeTruthy();
    expect(within(screen.getByTestId('m16-ds-tiles')).getByText(String(getLocalBackend().raw('skills').length))).toBeTruthy();
    expect(screen.getByTestId('m16-ds-download')).toBeTruthy();
  });
  it('renders in Arabic', async () => {
    await renderPage(<DatasheetPage />, { persona: null, path: '/ar/skills/datasheet' });
    await screen.findByTestId('m16-datasheet', {}, W);
    expect(document.body.textContent).toMatch(/كيف يُعالَج التحيّز/);
  });
});

describe('FS55 /admin/ai-transparency: ranked surfaces, surface fairness and the model-risk template', () => {
  it('the surfaces tab lists every ranked surface with its card; the surface-fairness tab compares each new surface', async () => {
    await renderPage(<AiTransparencyPage />, { persona: 'k-admin', path: '/admin/ai-transparency' });
    const cards = await screen.findByTestId('m16-engine-cards', {}, W);
    expect(within(cards).getAllByTestId('m16-engine-card')).toHaveLength(RANKED_SURFACES.length);
    fireEvent.click(screen.getByRole('tab', { name: /Ranked surfaces/ }));
    const reg = await screen.findByTestId('m16-reg-table', {}, W);
    expect(reg.getAttribute('data-missing')).toBe('0');
    fireEvent.click(screen.getByRole('tab', { name: /Surface fairness/ }));
    const comps = await screen.findByTestId('m16-sf-comparisons', {}, W);
    expect(new Set(within(comps).getAllByTestId('m16-sf-comparison').map((c) => c.getAttribute('data-metric')))).toEqual(new Set(SURFACE_METRICS.map((m) => m.metric)));
    expect(screen.getByTestId('m16-sf-run')).toBeTruthy();
  });
  it('the model-risk template pre-fills from the chosen card, marks gate items and states the gateway is off', async () => {
    await renderPage(<ModelRiskPage />, { persona: 'k-auditor', path: '/admin/ai-transparency/model-risk' });
    const sections = await screen.findByTestId('m16-mr-sections', {}, W);
    expect(screen.getByTestId('m16-mr-status').getAttribute('data-gateway')).toBe('off');
    expect(sections.querySelector('[data-field="use.purpose"]')!.getAttribute('data-filled')).toBe('true');
    expect(sections.querySelector('[data-field="validation.evalset"]')!.getAttribute('data-filled')).toBe('false');
    fireEvent.change(screen.getByTestId('m16-mr-card'), { target: { value: 'digest' } });
    await waitFor(() => expect(sections.querySelector('[data-field="fairness.metric"]')!.textContent).toMatch(/weekly digest/), W);
  });
});
