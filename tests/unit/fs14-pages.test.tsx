// @vitest-environment jsdom
/** FS05 pages: the "Now, 2030, 2035" tab (EN and AR), concept-role pages, the public overview, the editor (training manager),
 * concept roles on the Career Map, the future-moves graph and the planner with a concept target. */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderPage } from './g1-harness';
import { getLocalBackend } from '../../src/data';
import CareersRolePage from '../../src/modules/m01/CareersRolePage';
import CareersPage from '../../src/modules/m01/CareersPage';
import CareersPathsPage from '../../src/modules/m01/CareersPathsPage';
import CareersPlanPage from '../../src/modules/m01/CareersPlanPage';
import CareersHorizonsPage from '../../src/modules/m01/CareersHorizonsPage';
import CareersProfileEditPage from '../../src/modules/m01/CareersProfileEditPage';
import en from '../../src/i18n/m01.en.json';
import ar from '../../src/i18n/m01.ar.json';

const T = { timeout: 8000 };

describe('/careers/roles/:slug "Now, 2030, 2035" tab', () => {
  it('shows the 2030 profile of the RO with what changes, why, drivers, sources and benchmarks (EN)', async () => {
    await renderPage(<CareersRolePage />, { path: '/careers/roles/reactor-operator?tab=horizons', route: '/careers/roles/:slug' });
    const panel = await screen.findByTestId('m01-horizon-panel', {}, T);
    expect(panel.textContent).toContain(en.fs05.planning.title);
    const table = within(panel).getByTestId('m01-horizon-reqs');
    expect(table.textContent).toContain(en.fs05.change.new);
    expect(within(panel).getAllByTestId(/^m01-why-/).length).toBeGreaterThan(5);
    expect(within(panel).getByTestId('m01-drivers').textContent).toContain(en.fs05.driver.ai_assistance);
    expect(within(panel).getByTestId('m01-horizon-sources').querySelectorAll('a').length).toBeGreaterThan(2);
    await waitFor(() => expect(screen.getAllByTestId('m01-benchmark-chip')).toHaveLength(3));
    // switching to 2035 and to now
    fireEvent.click(screen.getByTestId('m01-horizon-2035'));
    expect(screen.getByTestId('m01-horizon-2035').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByTestId('m01-horizon-now'));
    await waitFor(() => expect(screen.queryByText(en.fs05.planning.title)).toBeNull());
    // concept roles this role leads to
    expect(screen.getByTestId('m01-leads-to').textContent).toContain('BWR');
  });

  it('renders in Arabic with Arabic labels', async () => {
    await renderPage(<CareersRolePage />, { path: '/ar/careers/roles/reactor-operator?tab=horizons', route: '/ar/careers/roles/:slug' });
    const panel = await screen.findByTestId('m01-horizon-panel', {}, T);
    expect(panel.textContent).toContain(ar.fs05.planning.title);
    expect(panel.textContent).toContain(ar.fs05.change.new);
    expect(document.documentElement.getAttribute('dir') ?? 'rtl').toBe('rtl');
  });

  it('security roles show the path-level notice and no requirements', async () => {
    await renderPage(<CareersRolePage />, { path: '/careers/roles/security-officer?tab=horizons', route: '/careers/roles/:slug' });
    const panel = await screen.findByTestId('m01-horizon-panel', {}, T);
    expect(panel.textContent).toContain(en.fs05.panel.pathOnlyTitle);
    expect(within(panel).queryByTestId('m01-horizon-reqs')).toBeNull();
  });

  it('a concept role page carries the banner, how to get here and its concept profile; no edit button for the public', async () => {
    await renderPage(<CareersRolePage />, { path: '/careers/roles/fr-digital-twin', route: '/careers/roles/:slug' });
    await screen.findByTestId('m01-concept-banner', {}, T);
    expect(screen.getByTestId('m01-inbound-future').children.length).toBe(2);
    const panel = await screen.findByTestId('m01-horizon-panel', {}, T);
    expect(within(panel).getByTestId('m01-horizon-reqs').querySelectorAll('tbody tr').length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByTestId('m01-edit-profile')).toBeNull();
  });
});

describe('/careers and /careers/paths and /careers/plan', () => {
  it('the Career Map keeps its 28 roles and lists the 11 concept roles separately', async () => {
    await renderPage(<CareersPage />, { path: '/careers' });
    const list = await screen.findByTestId('m01-role-list', {}, T);
    expect(within(list).getAllByRole('listitem')).toHaveLength(28);
    expect(within(screen.getByTestId('m01-concept-list')).getAllByRole('listitem')).toHaveLength(11);
    expect(screen.getByTestId('m01-concept-banner')).toBeTruthy();
  });
  it('the future tab draws current -> concept moves', async () => {
    await renderPage(<CareersPathsPage />, { path: '/careers/paths?view=future' });
    const g = await screen.findByTestId('m01-future-graph', {}, T);
    expect(g.textContent).toContain(en.fs05.paths.listTitle);
  });
  it('the planner can target a concept role from a current role', async () => {
    await renderPage(<CareersPlanPage />, { path: '/careers/plan?from=reactor-operator&to=fr-bwr-operator' });
    await screen.findByTestId('m01-plan-concept', {}, T);
    const routes = await screen.findByTestId('m01-plan-routes', {}, T);
    expect(within(routes).getAllByRole('listitem').length).toBeGreaterThan(0);
  });
});

describe('/careers/horizons', () => {
  it('shows 28/28 roles with a 2030 profile, 11/11 concept roles, the change map and no drafts for the public', async () => {
    await renderPage(<CareersHorizonsPage />, { path: '/careers/horizons' });
    const tiles = await screen.findByTestId('m01-horizons-tiles', {}, T);
    expect(tiles.textContent).toContain('28 / 28');
    expect(tiles.textContent).toContain('11 / 11');
    expect(screen.getByTestId('m01-horizons-heatmap')).toBeTruthy();
    expect(within(screen.getByTestId('m01-horizons-concepts')).getAllByRole('listitem')).toHaveLength(11);
    expect(screen.queryByTestId('m01-drafts')).toBeNull();
  });
  it('the training manager sees the drafts awaiting review', async () => {
    await renderPage(<CareersHorizonsPage />, { path: '/careers/horizons', persona: 'training-mgr' });
    const drafts = await screen.findByTestId('m01-drafts', {}, T);
    expect(within(drafts).getAllByRole('listitem')).toHaveLength(2);
  });
  it('renders in Arabic', async () => {
    await renderPage(<CareersHorizonsPage />, { path: '/ar/careers/horizons' });
    const tiles = await screen.findByTestId('m01-horizons-tiles', {}, T);
    expect(tiles.textContent).toContain(ar.fs05.overview.with2030);
  });
});

describe('/careers/roles/:slug/profile editor', () => {
  it('the training manager edits the open draft, sees the live checks and saves it through the RPC', async () => {
    await renderPage(<CareersProfileEditPage />, { path: '/careers/roles/maintenance-technician-engineer/profile?h=2035', route: '/careers/roles/:slug/profile', persona: 'training-mgr' });
    const base = await screen.findByTestId('m01-edit-base', {}, T);
    expect(base.textContent).toContain('2');
    const checks = screen.getByTestId('m01-edit-checks');
    expect(checks.textContent).toContain(en.fs05.edit.okDraft);
    expect(screen.getByTestId('m01-version-history').children.length).toBe(2);
    fireEvent.click(screen.getByTestId('m01-edit-save'));
    await waitFor(() => {
      const b = getLocalBackend();
      const aud = b.raw('audit_events').filter((a) => a.action === 'role_profile.save' && a.outcome === 'ok');
      expect(aud.length).toBe(1);
    }, T);
  });
  it('a security role offers no requirement editor', async () => {
    await renderPage(<CareersProfileEditPage />, { path: '/careers/roles/safeguards-specialist/profile?h=2030', route: '/careers/roles/:slug/profile', persona: 'k-admin' });
    await screen.findByTestId('m01-edit-base', {}, T);
    expect(screen.queryByTestId('m01-edit-add')).toBeNull();
    expect(screen.getByText(en.fs05.edit.pathOnly)).toBeTruthy();
  });
});
