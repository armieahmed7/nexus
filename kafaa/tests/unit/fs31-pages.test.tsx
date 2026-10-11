// @vitest-environment jsdom
/** FS17/FS18 pages rendered with the real providers and the in-memory LocalBackend: the pathway catalogue (EN and AR), a pathway with
 *  its steps, requested steps and colleagues' times, my pathways, the external catalogue with criteria and source links, the Coach tab,
 *  and the two training pages (editable for the training manager, read only for the auditor). Every page shows its benchmark chips. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderPage } from './g1-harness';
import PathwaysPage from '../../src/modules/m19/PathwaysPage';
import PathwayPage from '../../src/modules/m19/PathwayPage';
import MyPathwaysPage from '../../src/modules/m19/MyPathwaysPage';
import ExternalCataloguePage from '../../src/modules/m19/ExternalCataloguePage';
import TrainingPathwaysPage from '../../src/modules/m19/TrainingPathwaysPage';
import TrainingExternalPage from '../../src/modules/m19/TrainingExternalPage';
import { FutureSkillsCoach } from '../../src/modules/m19/FutureSkillsCoach';

const T = { timeout: 30000 };

describe('FS17/FS18 pages', () => {
  it('the catalogue lists a pathway for every future skill with envelope, weekly hours and the FS17 chips', async () => {
    await renderPage(<PathwaysPage />, { persona: 'k-ro', path: '/learn/pathways' });
    const skills = await screen.findAllByTestId('m19-pw-skill', {}, { timeout: 90000 });
    expect(skills.length).toBe(48);
    expect(screen.getAllByTestId('m19-pw-card').length).toBeGreaterThanOrEqual(90);
    expect(screen.getAllByTestId('m19-envelope').length).toBeGreaterThanOrEqual(90);
    expect(screen.getAllByTestId('m19-peer').some((x) => x.getAttribute('data-suppressed') === 'true')).toBe(true);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-ENTITLE').tagName).toBe('BUTTON'), T);
  }, 150000);
  it('the catalogue renders in Arabic', async () => {
    await renderPage(<PathwaysPage />, { persona: 'k-ro', path: '/ar/learn/pathways' });
    expect((await screen.findAllByTestId('m19-pw-skill', {}, T)).length).toBe(48);
    expect(document.body.textContent).toContain('مسارات المهارات المستقبلية');
  }, 60000);
  it('a pathway shows its steps, a requested step and colleagues\' time, and can be started', async () => {
    await renderPage(<Routes><Route path="/learn/pathways/:id" element={<PathwayPage />} /></Routes>, { persona: 'sro', path: '/learn/pathways/pw-gr-esg-l1' });
    const steps = await screen.findAllByTestId('m19-pw-step', {}, T);
    expect(steps.map((s) => s.getAttribute('data-kind'))).toEqual(['learn', 'practice', 'assess']);
    expect(steps.some((s) => s.getAttribute('data-status') === 'requested')).toBe(true);
    expect(screen.getAllByTestId('m19-pw-requested-note').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('m19-pw-start'));
    fireEvent.click(await screen.findByRole('button', { name: /confirm/i }));
    expect(await screen.findByTestId('m19-pw-progress', {}, T)).toBeTruthy();
  }, 60000);
  it('a resolved pathway shows its items with the external chip', async () => {
    await renderPage(<Routes><Route path="/learn/pathways/:id" element={<PathwayPage />} /></Routes>, { persona: 'k-ro', path: '/learn/pathways/pw-gr-climaterisk-l1' });
    await screen.findAllByTestId('m19-pw-step', {}, T);
    expect(screen.getAllByTestId('m19-step-item').some((x) => x.getAttribute('data-type') === 'external')).toBe(true);
    expect(screen.getAllByTestId('m19-external-chip').length).toBeGreaterThan(0);
  }, 60000);
  it('my pathways lists my active pathway with derived progress', async () => {
    await renderPage(<MyPathwaysPage />, { persona: 'k-ro', path: '/my/pathways' });
    const list = await screen.findByTestId('m19-my-active', {}, T);
    expect(list.querySelectorAll('[data-testid="m19-my-pw"]').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('m19-my-pw-progress').length).toBeGreaterThanOrEqual(1);
  }, 60000);
  it('the external catalogue lists published items with source links and the criteria, and records a self-declared completion', async () => {
    await renderPage(<ExternalCataloguePage />, { persona: 'sro', path: '/learn/external' });
    const cards = await screen.findAllByTestId('m19-xr-card', {}, T);
    expect(cards.length).toBe(13); // FS wave E QA: + 5 published FS42/FS43 readings (xr-et-*)
    expect(screen.getAllByTestId('m19-xr-source').length).toBe(13);
    expect(screen.getAllByTestId('m19-xr-criterion').length).toBe(4);
    await waitFor(() => expect(screen.getByTestId('benchmark-chip-NUC-NET').tagName).toBe('BUTTON'), T);
    fireEvent.click(screen.getAllByTestId('m19-xr-record')[0]);
    expect(screen.getByTestId('m19-xr-self-note').textContent).toMatch(/self-declared/);
    fireEvent.click(screen.getByTestId('m19-xr-record-confirm'));
    expect((await screen.findAllByTestId('m19-self-declared', {}, T)).length).toBeGreaterThan(0);
  }, 60000);
  it('the Coach tab ranks pathways with reasons', async () => {
    await renderPage(<FutureSkillsCoach />, { persona: 'k-ro', path: '/my/coach' });
    const cards = await screen.findAllByTestId('m19-pw-coach-card', {}, T);
    expect(cards.length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByTestId('m19-pw-why')[0]);
    expect((await screen.findByTestId('m19-pw-why-panel')).textContent!.length).toBeGreaterThan(10);
  }, 60000);
  it('training pathways: the training manager edits; the gap backlog is listed', async () => {
    await renderPage(<TrainingPathwaysPage />, { persona: 'training-mgr', path: '/training/pathways' });
    expect(await screen.findByTestId('m19-adm-new', {}, T)).toBeTruthy();
    fireEvent.click(screen.getByTestId('m19-adm-new'));
    expect(await screen.findByTestId('m19-adm-problems')).toBeTruthy();
  }, 60000);
  it('training pathways and external curation are read only for the auditor; failing drafts are flagged', async () => {
    await renderPage(<TrainingExternalPage />, { persona: 'k-auditor', path: '/training/external' });
    await screen.findByTestId('m19-xadm-tiles', {}, T);
    expect(screen.queryByTestId('m19-xadm-new')).toBeNull();
    expect(document.body.textContent).toMatch(/Fails/);
  }, 60000);
});
