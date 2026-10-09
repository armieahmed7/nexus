// @vitest-environment jsdom
/**
 * Wave 3 integration (QA lead): the hand-offs between wave-3 features and earlier waves once w3e1..w3e5 are merged.
 *  - F18 -> F24: the fairness monitor's HiPo metric reads the F18 review placements (source review_placements).
 *  - F19 -> F22: roles with a live F19 slate take their named successors from the slate, not F05 shortlists.
 *  - F20 -> F19: the succession slate shows the role's KLRA positions to viewers who may open the KLRA.
 *  - F21 -> M02: assets attached "read before requal" appear on the qualification standard and on My qualifications.
 *  - F23 -> F17: the expert finder points to alumni who opted into the finder (count only, link to the reserve).
 *  - F12 / F18 hand-off: the audited aspiration read no longer invalidates every query on the local backend.
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import seed from '../../src/seed/seed.json';
import { SCHEMA } from '../../src/data/schema';
import { LocalBackend } from '../../src/data/local/LocalBackend';
import { renderPage } from './g1-harness';
import TrainingQualsStandardPage from '../../src/modules/m02/TrainingQualsStandardPage';
import ExpertsPage from '../../src/modules/m22/ExpertsPage';
import { KlraRoleLinks, ReadBeforeRequal } from '../../src/modules/m24/links';

type Rows = Record<string, any>[];
const T = (seed as unknown as { tables: Record<string, Rows> }).tables;
const WAIT = { timeout: 20000 };

describe('wave 3 merged schema and seed', () => {
  it('has every wave-3 table', () => {
    for (const t of ['review_cycles', 'perf_ratings', 'review_placements', 'talent_priorities', 'talent_pool', 'succession_slates', 'successors', 'bench_rollups',
      'klra_settings', 'klra_positions', 'klra_assessments', 'klra_actions', 'sme_profiles', 'capture_sessions', 'knowledge_assets', 'asset_reviews', 'asset_uses',
      'external_cover', 'handover_cohorts', 'alumni', 'reserve_requests', 'reserve_engagements', 'alumni_stories', 'engine_cards', 'reco_optouts', 'fairness_snapshots', 'engine_changes'])
      expect(Object.prototype.hasOwnProperty.call(SCHEMA, t), t).toBe(true);
  });
  it('F18 -> F24: every HiPo fairness row is computed from the F18 placements', () => {
    const hipo = T.fairness_snapshots.filter((r) => r.metric === 'hipo_pool');
    expect(hipo).toHaveLength(40);
    expect(hipo.every((r) => r.source === 'review_placements')).toBe(true);
  });
});

describe('F19 -> F22: the handover board follows the F19 slates', () => {
  it('SRO and RO take their named successors from their slates; roles without a slate keep F05', async () => {
    const b = new LocalBackend();
    await b.whenReady();
    b.setPersona('chco');
    await b.whenReady();
    const r = (await b.rpc.handoverAggregate('2026-Q3')).data!;
    const src = (k: string) => r.roles.find((g) => g.key === k)?.source;
    expect(src('senior-reactor-operator')).toBe('f19');
    expect(src('reactor-operator')).toBe('f19');
    expect(src('maintenance-technician-engineer')).toBe('f05');
    expect(JSON.stringify(r)).not.toMatch(/"(w-sro-01|p-k-ro)"/);
  });
});

describe('F12 / F18: the audited aspiration read does not loop', () => {
  it('talentAspirations announces audit_events only, never an empty (= every table) change', async () => {
    const b = new LocalBackend();
    await b.whenReady();
    b.setPersona('chco');
    await b.whenReady();
    const seen: string[][] = [];
    const off = b.subscribe((t) => seen.push([...t]));
    const r = await b.rpc.talentAspirations(['p-qc-inspector']);
    off?.();
    expect(r.ok).toBe(true);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((t) => t.length > 0 && !t.includes('career_conversations'))).toBe(true);
  });
});

describe('F21 -> M02: read before requalification', () => {
  it('the qualification standard lists the published asset attached to it', async () => {
    await renderPage(<TrainingQualsStandardPage />, { persona: 'training-mgr', path: '/training/quals/qs-mech', route: '/training/quals/:standard' });
    const card = await screen.findByTestId('m24-read-before-requal', {}, WAIT);
    const kas = T.knowledge_assets.find((a) => a.id === 'kas-001')!;
    expect(within(card).getByText(kas.title_en).closest('a')?.getAttribute('href')).toContain('/knowledge/assets/kas-001');
  });
  it('renders nothing for a standard with no attached asset', async () => {
    const { container } = await renderPage(<ReadBeforeRequal standardIds={['qs-none']} />, { persona: 'training-mgr' });
    await new Promise((r) => setTimeout(r, 300));
    expect(container.querySelector('[data-testid="m24-read-before-requal"]')).toBeNull();
  });
});

describe('F20 -> F19: knowledge loss risk on the succession slate', () => {
  it('the KM owner sees the role\'s KLRA positions with their band, linked to the position page', async () => {
    await renderPage(<KlraRoleLinks roleId="senior-reactor-operator" />, { persona: 'training-mgr' });
    const card = await screen.findByTestId('m24-klra-role-links', {}, WAIT);
    await waitFor(() => expect(card.querySelectorAll('a[href*="/knowledge/klra/"]').length).toBeGreaterThan(0), WAIT);
  });
  it('HR (aggregates only) gets the link to the department view, no positions', async () => {
    await renderPage(<KlraRoleLinks roleId="senior-reactor-operator" />, { persona: 'chco' });
    const card = await screen.findByTestId('m24-klra-role-links', {}, WAIT);
    await waitFor(() => expect(within(card).getByText(/No assessed KLRA position/)).toBeTruthy(), WAIT);
    expect(card.querySelectorAll('a[href*="/knowledge/klra/"]').length).toBe(0);
  });
  it('a viewer who cannot open the KLRA sees nothing', async () => {
    const { container } = await renderPage(<KlraRoleLinks roleId="senior-reactor-operator" />, { persona: 'qc-inspector' });
    await new Promise((r) => setTimeout(r, 300));
    expect(container.querySelector('[data-testid="m24-klra-role-links"]')).toBeNull();
  });
});

describe('F23 -> F17: the expert finder points to the alumni reserve', () => {
  it('shows the number of alumni who opted into the finder and links to the reserve', async () => {
    await renderPage(<ExpertsPage />, { persona: 'qc-inspector', path: '/communities/experts' });
    const note = await screen.findByTestId('m20-reserve-experts-note', {}, WAIT);
    const n = T.alumni.filter((m) => m.finder_visible && m.status === 'active').length;
    expect(n).toBeGreaterThan(0);
    expect(note.textContent).toContain(String(n));
    expect(note.querySelector('a')?.getAttribute('href')).toContain('/opportunities/reserve');
    expect(note.textContent).not.toMatch(/@|\+971/);
  });
});
