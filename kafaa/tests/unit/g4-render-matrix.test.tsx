// @vitest-environment jsdom
/** [G4] Render every M09/M11 page as a spread of personas (in both languages) and check it settles without an error state.
 *  A jsdom stand-in for the Playwright smoke pass, which runs separately. Guards are not applied here, so this also proves
 *  that a page shows an empty or not-found state, never a crash, when the repository returns nothing for the caller. */
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { ComponentType } from 'react';
import { renderG4 } from './g4-harness';
import PartnersPage from '../../src/modules/m09/PartnersPage';
import PartnersDetailPage from '../../src/modules/m09/PartnersDetailPage';
import SuppliersPage from '../../src/modules/m09/SuppliersPage';
import PartnerPage from '../../src/modules/m09/PartnerPage';
import PartnerOnboardingPage from '../../src/modules/m09/PartnerOnboardingPage';
import PartnerSummaryPage from '../../src/modules/m09/PartnerSummaryPage';
import PartnerAcademyPage from '../../src/modules/m09/PartnerAcademyPage';
import PartnerWorkforcePage from '../../src/modules/m09/PartnerWorkforcePage';
import PartnerIcvPage from '../../src/modules/m09/PartnerIcvPage';
import AdminSuppliersPage from '../../src/modules/m09/AdminSuppliersPage';
import TrainingEquivalencyPage from '../../src/modules/m09/TrainingEquivalencyPage';
import FuturePage from '../../src/modules/m11/FuturePage';
import FutureTechPage from '../../src/modules/m11/FutureTechPage';
import WorkforceFuturePage from '../../src/modules/m11/WorkforceFuturePage';

const PAGES: [string, ComponentType, string, string?][] = [
  ['partners', PartnersPage, '/partners'],
  ['partners-detail', PartnersDetailPage, '/partners/kepco', '/partners/:slug'],
  ['suppliers', SuppliersPage, '/suppliers'],
  ['partner', PartnerPage, '/partner'],
  ['partner-onboarding', PartnerOnboardingPage, '/partner/onboarding?tab=documents'],
  ['partner-readiness-summary', PartnerSummaryPage, '/partner/onboarding/summary'],
  ['partner-academy', PartnerAcademyPage, '/partner/academy'],
  ['partner-workforce', PartnerWorkforcePage, '/partner/workforce'],
  ['partner-icv', PartnerIcvPage, '/partner/icv'],
  ['admin-suppliers', AdminSuppliersPage, '/admin/suppliers'],
  ['training-equivalency', TrainingEquivalencyPage, '/training/equivalency'],
  ['future', FuturePage, '/future'],
  ['future-tech', FutureTechPage, '/future/htgr', '/future/:tech'],
  ['workforce-future', WorkforceFuturePage, '/workforce/future'],
];
const PERSONAS = [null, 'k-ro', 'training-mgr', 'alnoor-gm', 'alnoor-sales', 'gulfhydro-qa', 'k-contractor', 'meridia-pd', 'k-university', 'k-admin', 'k-auditor', 'k-hr-analyst'];

describe('every G4 page settles for every persona', () => {
  for (const [id, Page, path, route] of PAGES) {
    it(id, async () => {
      for (const persona of PERSONAS) {
        for (const lang of ['', '/ar']) {
          const { unmount } = await renderG4(<Page />, { persona, path: `${lang}${path}`, route: route ? `${lang}${route}` : undefined });
          await waitFor(() => expect(screen.queryAllByTestId('skeleton')).toHaveLength(0), { timeout: 8000 });
          expect(screen.queryByTestId('error-state'), `${id} as ${persona ?? 'anon'} ${lang || '/en'}`).toBeNull();
          expect(document.querySelector('h1')?.textContent?.length ?? 0).toBeGreaterThan(0);
          unmount();
        }
      }
    }, 120_000);
  }
});
